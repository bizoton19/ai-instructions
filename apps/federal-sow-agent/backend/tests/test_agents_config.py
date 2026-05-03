"""Agent catalog and pipeline wiring invariants."""

from __future__ import annotations

from app.agents_config import (
    AGENTS,
    CLARIFICATION_TAG,
    DEFAULT_PIPELINE_SEQUENCE,
    PIPELINE_DEPENDENCIES,
    PIPELINE_PHASE_INSTRUCTIONS,
    get_agent_profile,
    get_phase_artifact_info,
    pipeline_sequence_warnings,
)


def test_pipeline_sequence_has_no_unknown_ids():
    assert pipeline_sequence_warnings() == []


def test_each_phase_has_distinct_output_schema():
    schemas = [AGENTS[aid].output_schema.__name__ for aid in DEFAULT_PIPELINE_SEQUENCE]
    assert len(schemas) == len(set(schemas)), f"Duplicate schemas: {schemas}"


def test_each_phase_has_phase_instructions():
    for aid in DEFAULT_PIPELINE_SEQUENCE:
        assert aid in PIPELINE_PHASE_INSTRUCTIONS
        assert len(PIPELINE_PHASE_INSTRUCTIONS[aid].strip()) > 20


def test_dependencies_reference_prior_phases_only():
    prior: set[str] = set()
    for aid in DEFAULT_PIPELINE_SEQUENCE:
        deps = PIPELINE_DEPENDENCIES.get(aid, [])
        for d in deps:
            assert d in prior, f"{aid} depends on {d} which is not in prior phases {prior}"
        prior.add(aid)


def test_get_agent_profile_unknown_falls_back_to_sow_writer():
    p = get_agent_profile("nonexistent_phase")
    assert p.id == "sow_writer"


def test_phase_artifact_filenames_are_unique_and_ordered():
    names = [get_phase_artifact_info(aid)["artifact_filename"] for aid in DEFAULT_PIPELINE_SEQUENCE]
    assert len(names) == len(set(names))
    assert names[0].startswith("01_")
    assert names[-1].startswith("05_")


def test_requirements_agent_prompt_includes_clarification_tag():
    assert CLARIFICATION_TAG in AGENTS["requirements_agent"].system_prompt
