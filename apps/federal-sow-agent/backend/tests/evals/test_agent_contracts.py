"""
Static agent "evals": contract checks on prompts and catalog wiring.

These are not live LLM evaluations; they catch regressions in role separation
and required behaviors without API calls.
"""

from __future__ import annotations

import re

import pytest

from app.agents_config import AGENTS, DEFAULT_PIPELINE_SEQUENCE


@pytest.mark.parametrize("agent_id", list(DEFAULT_PIPELINE_SEQUENCE))
def test_system_prompt_forbids_wrong_deliverable(agent_id: str):
    """Each specialist explicitly rejects producing the wrong document type."""
    prompt = AGENTS[agent_id].system_prompt
    if agent_id == "sow_writer":
        assert "NOT writing an SOW" not in prompt or "ARE writing the SOW" in prompt
        assert "SOW" in prompt or "PWS" in prompt
        return
    if agent_id == "cost_estimator":
        assert "NOT writing an SOW" in prompt or "NOT writing an SOW." in prompt
        assert "IGCE" in prompt
        return
    assert "NOT writing an SOW" in prompt
    assert "NOT writing an IGCE" in prompt or "not writing an IGCE" in prompt.lower()


@pytest.mark.parametrize("agent_id", list(DEFAULT_PIPELINE_SEQUENCE))
def test_system_prompt_requires_json_only(agent_id: str):
    p = AGENTS[agent_id].system_prompt
    assert "Return ONLY valid JSON" in p or "valid JSON" in p
    assert "markdown fences" in p.lower() or "No markdown fences" in p


def test_requirements_discovery_clarification_contract():
    p = AGENTS["requirements_agent"].system_prompt
    assert "CLARIFICATION_NEEDED:" in p
    assert "SMART" in p


def test_cost_estimator_maps_from_sow():
    p = AGENTS["cost_estimator"].system_prompt
    assert re.search(r"SOW|prior phase", p, re.IGNORECASE)


def test_sow_writer_merges_prior_phases():
    p = AGENTS["sow_writer"].system_prompt
    assert "System Requirements" in p or "Requirements" in p
    assert "Market Research" in p
