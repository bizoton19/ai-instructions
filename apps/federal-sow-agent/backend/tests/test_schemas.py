"""Pydantic schema round-trips for pipeline artifact models."""

from __future__ import annotations

import json

from app.schemas import (
    IGCECostModel,
    MarketResearchModel,
    RequirementsAnalystModel,
    RequirementsDiscoveryModel,
    SOWSectionsModel,
)


def test_requirements_discovery_minimal_roundtrip():
    m = RequirementsDiscoveryModel(
        executive_summary="Summary",
        key_objectives=["Obj A"],
        known_requirements=[{"id": "R1", "text": "Do X"}],
        clarification_questions=["What is the POP?"],
        gaps_and_risks=["Scope unclear"],
        stakeholder_recommendations=["COR"],
        full_markdown="## Clarification\n\nBody",
    )
    data = m.model_dump()
    restored = RequirementsDiscoveryModel.model_validate(data)
    assert restored.full_markdown.startswith("## Clarification")
    assert json.dumps(data)  # serializable


def test_requirements_analyst_minimal_roundtrip():
    m = RequirementsAnalystModel(
        document_title="SRD v1",
        functional_requirements=[{"id": "REQ-001", "description": "The system shall…", "verification_method": "test"}],
        full_markdown="## Requirements\n",
    )
    restored = RequirementsAnalystModel.model_validate_json(m.model_dump_json())
    assert restored.document_title == "SRD v1"


def test_market_research_minimal_roundtrip():
    m = MarketResearchModel(
        report_title="MR",
        small_business_analysis={"feasible": True, "recommended_set_aside": "8(a)"},
        full_markdown="## Market\n",
    )
    assert MarketResearchModel.model_validate(m.model_dump()).report_title == "MR"


def test_sow_sections_minimal_roundtrip():
    m = SOWSectionsModel(scope="Scope text", full_markdown="## SOW\n")
    assert SOWSectionsModel.model_validate(m.model_dump()).scope == "Scope text"


def test_igce_minimal_roundtrip():
    m = IGCECostModel(
        estimate_title="IGCE",
        labor_subtotal=100_000.0,
        total_estimate=150_000.0,
        full_markdown="## IGCE\n",
    )
    restored = IGCECostModel.model_validate(m.model_dump())
    assert restored.total_estimate == 150_000.0
