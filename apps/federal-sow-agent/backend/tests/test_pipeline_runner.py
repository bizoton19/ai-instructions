"""Pipeline execution with LLM calls mocked."""

from __future__ import annotations

import json
from unittest.mock import patch

from app.agents_config import DEFAULT_PIPELINE_SEQUENCE
from app.models import AgentSession, PipelineArtifact
from app.pipeline_runner import advance_pipeline, get_session_artifacts, reset_pipeline
from app.schemas import (
    IGCECostModel,
    MarketResearchModel,
    PipelineAdvanceIn,
    RequirementsAnalystModel,
    RequirementsDiscoveryModel,
    SOWSectionsModel,
)
from sqlalchemy.orm import Session


_SCHEMA_TO_AGENT = {
    RequirementsDiscoveryModel: "requirements_agent",
    RequirementsAnalystModel: "requirements_analyst",
    MarketResearchModel: "market_research",
    SOWSectionsModel: "sow_writer",
    IGCECostModel: "cost_estimator",
}


def _mock_return_for_agent(agent_id: str):
    if agent_id == "requirements_agent":
        return RequirementsDiscoveryModel(
            executive_summary="Exec",
            full_markdown="## Requirements clarification\n\nBody",
        ), []
    if agent_id == "requirements_analyst":
        return RequirementsAnalystModel(document_title="SRD", full_markdown="## SRD\n\nBody"), []
    if agent_id == "market_research":
        return MarketResearchModel(report_title="MR", full_markdown="## Market research\n\nBody"), []
    if agent_id == "sow_writer":
        return SOWSectionsModel(scope="Scope", full_markdown="## Statement of work\n\nBody"), []
    if agent_id == "cost_estimator":
        return IGCECostModel(estimate_title="IGCE", full_markdown="## IGCE\n\nBody"), []
    raise AssertionError(agent_id)


def _fake_specialist_chain(*args, **kwargs):
    schema = kwargs["output_schema"]
    agent_id = _SCHEMA_TO_AGENT[schema]
    return _mock_return_for_agent(agent_id)


def test_advance_pipeline_persists_distinct_artifacts(db_session: Session, workspace_id: str, session_id: str):
    session = db_session.get(AgentSession, session_id)
    assert session is not None
    session.orchestration_mode = "automatic"
    session.pipeline_paused = False
    db_session.commit()

    with patch("app.pipeline_runner.run_specialist_chain", side_effect=_fake_specialist_chain):
        body = PipelineAdvanceIn(execution="auto_chain", approve_manual_gate=True, clarification_resolved=True)
        err, payload = advance_pipeline(db_session, workspace_id, session_id, body)
        assert err is None
        assert payload.get("pipeline_completed") is True

    artifacts = get_session_artifacts(db_session, session_id)
    assert len(artifacts) == len(DEFAULT_PIPELINE_SEQUENCE)
    assert [a.artifact_type for a in artifacts] == list(DEFAULT_PIPELINE_SEQUENCE)

    markdown_bodies = [a.full_markdown.strip() for a in artifacts]
    assert len(set(markdown_bodies)) == len(markdown_bodies), "Each phase should produce different markdown"

    for a in artifacts:
        data = json.loads(a.structured_data_json)
        assert "full_markdown" in data
        assert data["full_markdown"] == a.full_markdown


def test_reset_pipeline_deletes_artifacts(db_session: Session, workspace_id: str, session_id: str):
    session = db_session.get(AgentSession, session_id)
    db_session.add(
        PipelineArtifact(
            session_id=session_id,
            workspace_id=workspace_id,
            phase_order=0,
            agent_id="requirements_agent",
            agent_name="Requirements Discovery Agent",
            artifact_type="requirements_agent",
            artifact_filename="01_requirements_clarification.md",
            artifact_description="test",
            structured_data_json="{}",
            full_markdown="# x",
            content_summary="s",
        )
    )
    db_session.commit()

    reset_pipeline(session, db_session)
    db_session.refresh(session)
    assert session.pipeline_step == 0
    assert db_session.query(PipelineArtifact).filter(PipelineArtifact.session_id == session_id).count() == 0
