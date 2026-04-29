"""Multi-phase specialist pipeline: sequential LangChain runs in one session."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.agent.sow_chain import run_sow_chain
from app.agents_config import CLARIFICATION_TAG, DEFAULT_PIPELINE_SEQUENCE, get_agent_profile
from app.context_builder import assemble_prior_pipeline_text, build_generation_inputs
from app.models import AgentSession, Message, Workspace
from app.schemas import PipelineAdvanceIn


def _needs_clarification(text: str | None) -> bool:
    if not text:
        return False
    return CLARIFICATION_TAG.lower() in text.lower()


def pipeline_total_phases() -> int:
    return len(DEFAULT_PIPELINE_SEQUENCE)


def snapshot(session: AgentSession) -> dict:
    return {
        "orchestration_mode": session.orchestration_mode or "manual_review",
        "pipeline_step": session.pipeline_step or 0,
        "pipeline_total_phases": pipeline_total_phases(),
        "pipeline_completed": bool(session.pipeline_completed),
        "pipeline_paused": bool(session.pipeline_paused),
        "needs_user_clarification": bool(session.needs_user_clarification),
    }


def _run_one_pipeline_phase(
    db: Session,
    workspace_id: str,
    session_id: str,
    additional_instructions: str,
) -> tuple[object, list[str], str]:
    """Executes LangChain once for session.pipeline_step. Persists assistant message."""
    session = db.get(AgentSession, session_id)
    if session is None or session.workspace_id != workspace_id:
        raise ValueError("session")

    seq = DEFAULT_PIPELINE_SEQUENCE
    step_idx = session.pipeline_step or 0

    agent_id = seq[step_idx]
    profile = get_agent_profile(agent_id)
    session.agent_type = agent_id

    context_block, template_hints = build_generation_inputs(db, workspace_id)
    prior = assemble_prior_pipeline_text(db, session.id)
    parts: list[str] = []
    if prior.strip():
        parts.append("Prior pipeline output to refine or build on:\n\n" + prior)
    if additional_instructions.strip():
        parts.append("Operator instructions for this phase:\n" + additional_instructions.strip())
    compiled = "\n\n".join(parts) if parts else ""

    sections, warnings = run_sow_chain(
        context_block=context_block,
        template_hints=template_hints,
        user_instructions=compiled or "[Execute this pipeline phase.]",
        system_prompt=profile.system_prompt,
    )

    body = (sections.full_markdown or sections.scope or "").strip()
    clar = _needs_clarification(body)
    if clar and CLARIFICATION_TAG.upper() not in body.upper():
        body += f"\n\n{CLARIFICATION_TAG} Reply in chat, answer the question, then continue with clarification_resolved."

    header = f"## Pipeline phase ({step_idx + 1}/{len(seq)}): {profile.name}\n\n"
    db.add(Message(session_id=session.id, role="assistant", content=header + body))
    session.pipeline_step = step_idx + 1
    session.needs_user_clarification = clar

    orch = session.orchestration_mode or "manual_review"
    session.pipeline_completed = (session.pipeline_step or 0) >= len(seq)
    if clar:
        session.pipeline_paused = True
    elif orch == "manual_review" and not session.pipeline_completed:
        session.pipeline_paused = True
    else:
        session.pipeline_paused = False

    db.commit()
    db.refresh(session)
    return sections, warnings, profile.name


def advance_pipeline(db: Session, workspace_id: str, session_id: str, body: PipelineAdvanceIn) -> tuple[dict | None, dict]:
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        return ({"detail": "Workspace not found", "status_code": 404}, {})

    session = db.get(AgentSession, session_id)
    if session is None or session.workspace_id != workspace_id:
        return ({"detail": "Session not found", "status_code": 404}, {})

    # Clarification stop
    if session.needs_user_clarification:
        if not body.clarification_resolved:
            pay = snapshot(session)
            return (
                {
                    "detail": {
                        "message": "Awaiting clarification. Reply in terminal, then resend clarification_resolved.",
                        **pay,
                    },
                    "status_code": 428,
                },
                {},
            )
        session.needs_user_clarification = False
        session.pipeline_paused = False
        db.commit()
        db.refresh(session)

    seq = DEFAULT_PIPELINE_SEQUENCE
    orch = session.orchestration_mode or "manual_review"

    idx = session.pipeline_step or 0
    if idx >= len(seq) or session.pipeline_completed:
        pay = snapshot(session)
        return (
            {"detail": {"message": "Pipeline finished", **pay}, "status_code": 400},
            {},
        )

    # Manual checkpoints between phases
    if orch == "manual_review" and session.pipeline_paused:
        if not body.approve_manual_gate:
            pay = snapshot(session)
            return (
                {
                    "detail": {
                        "message": "Manual review checkpoint. Set approve_manual_gate=true to invoke the next specialist.",
                        **pay,
                    },
                    "status_code": 428,
                },
                {},
            )
        session.pipeline_paused = False
        db.commit()

    exec_auto = body.execution == "auto_chain" and orch == "automatic"

    all_warnings: list[str] = []
    last_sections = None
    phases_run = 0
    last_phase = None

    while True:
        session = db.get(AgentSession, session_id)
        assert session is not None

        orch = session.orchestration_mode or "manual_review"
        idx_now = session.pipeline_step or 0

        if session.pipeline_completed or idx_now >= len(seq):
            out = snapshot(session)
            out.update(
                {
                    "warnings": all_warnings,
                    "sections": last_sections,
                    "phase_name_run": last_phase,
                    "phases_run": phases_run,
                }
            )
            return (None, out)

        extra = body.additional_instructions or "" if phases_run == 0 else ""

        sections, warns, pname = _run_one_pipeline_phase(
            db, workspace_id, session_id, extra
        )

        phases_run += 1
        last_phase = pname
        last_sections = sections
        all_warnings.extend(warns)

        session = db.get(AgentSession, session_id)
        assert session is not None

        if session.needs_user_clarification:
            out = snapshot(session)
            out.update(
                {
                    "warnings": all_warnings,
                    "sections": last_sections,
                    "phase_name_run": last_phase,
                    "phases_run": phases_run,
                }
            )
            return (None, out)

        if orch != "automatic" or not exec_auto:
            out = snapshot(session)
            out.update(
                {
                    "warnings": all_warnings,
                    "sections": last_sections,
                    "phase_name_run": last_phase,
                    "phases_run": phases_run,
                }
            )
            return (None, out)


def reset_pipeline(session: AgentSession, db: Session) -> None:
    session.pipeline_step = 0
    session.pipeline_completed = False
    session.pipeline_paused = False
    session.needs_user_clarification = False
    db.commit()
