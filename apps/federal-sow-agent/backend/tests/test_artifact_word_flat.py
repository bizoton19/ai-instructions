"""Word export flattening from pipeline artifacts (phase-aware)."""

from __future__ import annotations

import json

import pytest

from app.merge.artifact_word_flat import flat_context_from_pipeline_artifact
from app.models import PipelineArtifact


def _artifact(**kwargs) -> PipelineArtifact:
    defaults = {
        "session_id": "s1",
        "workspace_id": "w1",
        "phase_order": 0,
        "agent_id": "requirements_agent",
        "agent_name": "Requirements Discovery Agent",
        "artifact_type": "requirements_discovery",
        "artifact_filename": "01_requirements_clarification.md",
        "artifact_description": "Clarification doc",
        "structured_data_json": "{}",
        "full_markdown": "",
        "content_summary": None,
        "exported_docx_key": None,
        "exported_docx_note": None,
    }
    defaults.update(kwargs)
    return PipelineArtifact(**defaults)


def test_non_sow_empty_markdown_renders_structured_fields():
    data = {
        "executive_summary": "This is the narrative body from JSON only.",
        "source_document_profile": [{"kind": "spec", "detail": "example"}],
    }
    art = _artifact(
        full_markdown="",
        structured_data_json=json.dumps(data),
        agent_id="requirements_agent",
    )
    flat = flat_context_from_pipeline_artifact(art)
    assert "This is the narrative body from JSON only." in flat["full_markdown"]
    assert "kind" in flat["full_markdown"] and "spec" in flat["full_markdown"]


def test_non_sow_prefers_stored_markdown_over_embedded_json_markdown():
    data = {"full_markdown": "from json", "other": "x"}
    art = _artifact(
        full_markdown="# From stored column",
        structured_data_json=json.dumps(data),
        agent_id="market_research",
        agent_name="Market Research",
        artifact_type="market_research",
    )
    flat = flat_context_from_pipeline_artifact(art)
    assert "From stored column" in flat["full_markdown"]
    assert "from json" not in flat["full_markdown"]


def test_sow_writer_validates_structured_schema():
    structured = {
        "purpose": "P",
        "full_markdown": "## SOW body",
    }
    art = _artifact(
        agent_id="sow_writer",
        agent_name="SOW Writer",
        artifact_type="sow_writer",
        structured_data_json=json.dumps(structured),
        full_markdown="## Stored wins",
    )
    flat = flat_context_from_pipeline_artifact(art)
    assert flat["purpose"] == "P"
    assert "Stored wins" in flat["full_markdown"]


@pytest.mark.parametrize("agent_id", ["requirements_analyst", "cost_estimator"])
def test_non_sow_agents_never_require_sow_section_shape(agent_id):
    """Regression: non-SOW schemas must not raise when coercing to Word flat context."""
    structured = {
        "regression_test_field": "alpha",
        "items": [1, 2, 3],
    }
    art = _artifact(
        full_markdown="",
        structured_data_json=json.dumps(structured),
        agent_id=agent_id,
        agent_name=agent_id,
        artifact_type=agent_id,
    )
    flat = flat_context_from_pipeline_artifact(art)
    assert flat["full_markdown"].strip()
    assert "Regression" in flat["full_markdown"] or "Alpha" in flat["full_markdown"]
