"""Multi-phase specialist pipeline: sequential LangChain runs in one session."""

from __future__ import annotations

import json
from sqlalchemy.orm import Session

from app.agent.sow_chain import run_specialist_chain
from app.agents_config import (
    CLARIFICATION_TAG,
    DEFAULT_PIPELINE_SEQUENCE,
    PIPELINE_PHASE_INSTRUCTIONS,
    get_agent_profile,
    get_phase_artifact_info,
)
from app.context_builder import assemble_prior_pipeline_text, build_generation_inputs
from app.models import AgentSession, Message, PipelineArtifact, Workspace
from app.schemas import PipelineAdvanceIn, SOWSectionsModel


def _needs_clarification(text: str | None) -> bool:
    if not text:
        return False
    return CLARIFICATION_TAG.lower() in text.lower()


def _generate_summary(structured_data: dict, agent_id: str) -> str:
    """Generate a brief summary of the artifact for quick display."""
    summaries = []
    
    if agent_id == "requirements_agent":
        profile = (structured_data.get("source_document_profile") or "").strip()
        posture = (structured_data.get("assumed_it_project_posture") or "").strip()
        if profile:
            summaries.append(profile[:220] + ("…" if len(profile) > 220 else ""))
        if posture:
            summaries.append(posture[:220] + ("…" if len(posture) > 220 else ""))
        known = len(structured_data.get("known_requirements", []))
        questions = len(structured_data.get("clarification_questions", []))
        summaries.append(f"Identified {known} known requirements, {questions} clarification questions")
        if "key_objectives" in structured_data:
            summaries.append(f"Key objectives: {', '.join(structured_data['key_objectives'][:3])}")
    
    elif agent_id == "requirements_analyst":
        func_reqs = len(structured_data.get("functional_requirements", []))
        non_func = len(structured_data.get("non_functional_requirements", []))
        summaries.append(f"Documented {func_reqs} functional, {non_func} non-functional requirements")
    
    elif agent_id == "market_research":
        vendors = len(structured_data.get("vendor_landscape", []))
        items = len(structured_data.get("commercial_item_availability", []))
        summaries.append(f"Analyzed {vendors} potential vendors, {items} commercial items")
        if "small_business_analysis" in structured_data:
            sb = structured_data["small_business_analysis"]
            if isinstance(sb, dict):
                summaries.append(f"Small business set-aside: {sb.get('recommended_set_aside', 'TBD')}")
    
    elif agent_id == "sow_writer":
        scope = structured_data.get("scope", "")[:200]
        deliverables = structured_data.get("deliverables", "")[:200]
        summaries.append(f"Scope: {scope}..." if len(scope) >= 200 else f"Scope: {scope}")
        summaries.append(f"Deliverables: {deliverables}..." if len(deliverables) >= 200 else f"Deliverables: {deliverables}")
    
    elif agent_id == "cost_estimator":
        total = structured_data.get("total_estimate", 0)
        labor = structured_data.get("labor_subtotal", 0)
        cats = len(structured_data.get("labor_categories", []))
        summaries.append(f"Total estimate: ${total:,.2f} ({cats} labor categories)")
        summaries.append(f"Labor subtotal: ${labor:,.2f}")
    
    return " | ".join(summaries) if summaries else "Artifact generated"


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
        "pipeline_artifact_count": int(session.pipeline_artifact_count or 0),
    }


def _run_one_pipeline_phase(
    db: Session,
    workspace_id: str,
    session_id: str,
    additional_instructions: str,
) -> tuple[object, list[str], str, PipelineArtifact]:
    """Executes LangChain once for session.pipeline_step. Persists assistant message and artifact."""
    session = db.get(AgentSession, session_id)
    if session is None or session.workspace_id != workspace_id:
        raise ValueError("session")

    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise ValueError("workspace")

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
    phase_boost = PIPELINE_PHASE_INSTRUCTIONS.get(agent_id)
    if phase_boost:
        compiled = (
            (compiled + "\n\n--- Phase-specific scaffold guidance ---\n\n" + phase_boost).strip()
            if compiled
            else phase_boost.strip()
        )

    # Run the specialist with its specific output schema
    result_model, warnings = run_specialist_chain(
        context_block=context_block,
        template_hints=template_hints,
        user_instructions=compiled or "[Execute this pipeline phase.]",
        system_prompt=profile.system_prompt,
        output_schema=profile.output_schema,
        temperature=float(ws.agent_temperature),
        workspace_instructions=ws.agent_workspace_instructions,
    )

    # Convert result to dict for storage
    structured_data = result_model.model_dump()
    full_markdown = structured_data.get("full_markdown", "")
    
    body = full_markdown.strip()
    clar = _needs_clarification(body)
    if clar and CLARIFICATION_TAG.upper() not in body.upper():
        body += f"\n\n{CLARIFICATION_TAG} Reply in session chat with your answer, then continue with clarification_resolved."

    header = f"## Pipeline phase ({step_idx + 1}/{len(seq)}): {profile.name}\n\n"
    db.add(Message(session_id=session.id, role="assistant", content=header + body))
    
    # Create the distinct artifact for this phase
    artifact_info = get_phase_artifact_info(agent_id)
    content_summary = _generate_summary(structured_data, agent_id)
    
    artifact = PipelineArtifact(
        session_id=session.id,
        workspace_id=workspace_id,
        phase_order=step_idx,
        agent_id=agent_id,
        agent_name=profile.name,
        artifact_type=artifact_info["artifact_type"],
        artifact_filename=artifact_info["artifact_filename"],
        artifact_description=artifact_info["artifact_description"],
        structured_data_json=json.dumps(structured_data, indent=2, default=str),
        full_markdown=full_markdown,
        content_summary=content_summary,
    )
    db.add(artifact)
    
    session.pipeline_artifact_count = int(session.pipeline_artifact_count or 0) + 1
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
    db.refresh(artifact)
    
    return result_model, warnings, profile.name, artifact


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
                        "message": "Awaiting clarification. Reply in the session chat, then resend clarification_resolved.",
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
    last_result = None
    phases_run = 0
    last_phase = None
    last_artifact = None

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
                    "artifact_produced": last_artifact.artifact_type if last_artifact else None,
                    "phase_name_run": last_phase,
                    "phases_run": phases_run,
                    "latest_artifact_filename": last_artifact.artifact_filename if last_artifact else None,
                }
            )
            return (None, out)

        extra = body.additional_instructions or "" if phases_run == 0 else ""

        result_model, warns, pname, artifact = _run_one_pipeline_phase(
            db, workspace_id, session_id, extra
        )

        phases_run += 1
        last_phase = pname
        last_result = result_model
        last_artifact = artifact
        all_warnings.extend(warns)

        session = db.get(AgentSession, session_id)
        assert session is not None

        if session.needs_user_clarification:
            out = snapshot(session)
            out.update(
                {
                    "warnings": all_warnings,
                    "artifact_produced": artifact.artifact_type,
                    "phase_name_run": last_phase,
                    "phases_run": phases_run,
                    "latest_artifact_filename": artifact.artifact_filename,
                }
            )
            return (None, out)

        if orch != "automatic" or not exec_auto:
            out = snapshot(session)
            out.update(
                {
                    "warnings": all_warnings,
                    "artifact_produced": artifact.artifact_type,
                    "phase_name_run": last_phase,
                    "phases_run": phases_run,
                    "latest_artifact_filename": artifact.artifact_filename,
                }
            )
            return (None, out)


def reset_pipeline(session: AgentSession, db: Session) -> None:
    """Reset pipeline state and delete all artifacts for this session."""
    # Delete associated artifacts
    db.query(PipelineArtifact).filter(PipelineArtifact.session_id == session.id).delete()
    
    session.pipeline_step = 0
    session.pipeline_completed = False
    session.pipeline_paused = False
    session.needs_user_clarification = False
    session.pipeline_artifact_count = 0
    db.commit()


def get_session_artifacts(db: Session, session_id: str) -> list[PipelineArtifact]:
    """Get all artifacts for a session in phase order."""
    return (
        db.query(PipelineArtifact)
        .filter(PipelineArtifact.session_id == session_id)
        .order_by(PipelineArtifact.phase_order.asc())
        .all()
    )


def get_artifact_by_phase(db: Session, session_id: str, phase_order: int) -> PipelineArtifact | None:
    """Get a specific artifact by its phase order."""
    return (
        db.query(PipelineArtifact)
        .filter(PipelineArtifact.session_id == session_id, PipelineArtifact.phase_order == phase_order)
        .first()
    )
