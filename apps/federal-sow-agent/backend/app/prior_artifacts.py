"""Assemble bounded prior-phase artifact summaries for downstream LLM turns."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import PipelineArtifact

PER_ARTIFACT_SOFT_CAP = 24_000
TOTAL_SOFT_CAP = 96_000
TRUNCATION_MESSAGE = "\n\n[… truncated prior artifact block to respect context limits.]"

AGENTS_FOR_COST_ESTIMATOR: frozenset[str] = frozenset(
    {
        "requirements_agent",
        "requirements_analyst",
        "market_research",
        "sow_writer",
    }
)


def _render_one(artifact: PipelineArtifact) -> str:
    fm = (artifact.full_markdown or "").strip()
    head = (
        f"### Phase {artifact.phase_order + 1}: {artifact.agent_name} ({artifact.agent_id})\n"
        f"**Artifact type:** {artifact.artifact_type}\n\n"
    )
    if fm:
        body = fm[:PER_ARTIFACT_SOFT_CAP]
        if len(fm) > PER_ARTIFACT_SOFT_CAP:
            body += "\n[… full_markdown truncated …]\n"
        return head + body + "\n\n"
    try:
        structured = json.loads(artifact.structured_data_json or "{}")
    except Exception:
        structured = {}
    blob = structured if isinstance(structured, dict) else {}
    dumped = ""
    try:
        dumped = json.dumps(blob, indent=2, default=str)[:PER_ARTIFACT_SOFT_CAP]
    except Exception:
        dumped = str(blob)[:PER_ARTIFACT_SOFT_CAP]
    return (
        head
        + "Structured artifact (Markdown was empty — JSON excerpt below).\n\n"
        + "```json\n"
        + dumped
        + "\n```\n\n"
    )


def assemble_prior_artifacts_for_llm_block(
    db: Session,
    session_id: str,
    consumer_agent_id: str,
    *,
    upcoming_phase_order: int,
) -> str:
    """
    Return a single markdown block appended to downstream phase instructions.

    ``upcoming_phase_order`` is this run's phase index (0-based, same as ``session.pipeline_step`` at start of phase).

    sow_writer receives every completed prior artifact.

    cost_estimator receives artifacts from requirements/market/SOW predecessors so effort and cost tie to reqs + MR + scope.
    Other specialists receive all artifacts from earlier phases only (helps continuity).
    """
    if upcoming_phase_order <= 0:
        return ""

    q = (
        db.query(PipelineArtifact)
        .filter(PipelineArtifact.session_id == session_id, PipelineArtifact.phase_order < upcoming_phase_order)
        .order_by(PipelineArtifact.phase_order.asc())
        .all()
    )
    if not q:
        return ""

    if consumer_agent_id == "cost_estimator":
        q = [a for a in q if a.agent_id in AGENTS_FOR_COST_ESTIMATOR]
    elif consumer_agent_id == "sow_writer":
        pass
    elif consumer_agent_id in ("requirements_agent",):
        q = []

    if not q:
        return ""

    parts: list[str] = []
    buf_len = 0
    header = "## Prior pipeline artifacts (canonical session outputs)\n\n"
    buf_len += len(header)

    parts.append(header)
    for art in q:
        chunk = _render_one(art)
        if buf_len + len(chunk) > TOTAL_SOFT_CAP:
            parts.append(TRUNCATION_MESSAGE.strip())
            break
        parts.append(chunk)
        buf_len += len(chunk)

    return "".join(parts).strip()

