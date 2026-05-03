"""Prior pipeline artifact blocks injected into downstream phases."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models import PipelineArtifact
from app.prior_artifacts import AGENTS_FOR_COST_ESTIMATOR, assemble_prior_artifacts_for_llm_block


def test_sow_writer_receives_all_prior_phases(db_session: Session, session_id: str, workspace_id: str) -> None:
    for i, (aid, name) in enumerate(
        [
            ("requirements_agent", "RA"),
            ("requirements_analyst", "Analyst"),
            ("market_research", "MR"),
        ]
    ):
        db_session.add(
            PipelineArtifact(
                session_id=session_id,
                workspace_id=workspace_id,
                phase_order=i,
                agent_id=aid,
                agent_name=name,
                artifact_type=aid,
                artifact_filename=f"0{i}_x.md",
                artifact_description="desc",
                structured_data_json=json.dumps({"k": aid}),
                full_markdown=f"# {aid} body",
                content_summary=None,
            )
        )
    db_session.commit()

    block = assemble_prior_artifacts_for_llm_block(
        db_session, session_id, "sow_writer", upcoming_phase_order=3
    )
    assert "requirements_agent" in block
    assert "market_research" in block
    assert "canonical session outputs" in block.lower()


def test_cost_estimator_only_includes_designated_agents(db_session: Session, session_id: str, workspace_id: str) -> None:
    specs = [
        (0, "requirements_agent", "# A"),
        (1, "requirements_analyst", "# B"),
        (2, "market_research", "# C"),
        (3, "sow_writer", "# D"),
    ]
    for order, aid, md in specs:
        db_session.add(
            PipelineArtifact(
                session_id=session_id,
                workspace_id=workspace_id,
                phase_order=order,
                agent_id=aid,
                agent_name=aid,
                artifact_type=aid,
                artifact_filename=f"{order}.md",
                artifact_description="d",
                structured_data_json="{}",
                full_markdown=md,
                content_summary=None,
            )
        )
    db_session.commit()

    block = assemble_prior_artifacts_for_llm_block(
        db_session, session_id, "cost_estimator", upcoming_phase_order=4
    )
    for aid in AGENTS_FOR_COST_ESTIMATOR:
        assert aid in block
    assert "sow_writer" in block


def test_requirements_agent_phase_gets_no_prior_block(db_session: Session, session_id: str) -> None:
    assert (
        assemble_prior_artifacts_for_llm_block(
            db_session, session_id, "requirements_agent", upcoming_phase_order=0
        )
        == ""
    )
