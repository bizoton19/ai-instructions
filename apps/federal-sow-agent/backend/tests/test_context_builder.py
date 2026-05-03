"""Context assembly for multi-phase chaining."""

from __future__ import annotations

import json

from app.context_builder import assemble_prior_pipeline_text, build_generation_inputs
from app.models import ContextAsset, Message, TemplateAsset


def test_build_generation_inputs_empty_workspace(db_session, workspace_id):
    ctx, hints = build_generation_inputs(db_session, workspace_id)
    assert ctx == ""
    assert hints == ""


def test_build_generation_inputs_with_context_and_template(db_session, workspace_id):
    ca = ContextAsset(
        workspace_id=workspace_id,
        storage_key="k1",
        filename="brief.pdf",
        mime_type="application/pdf",
        kind="pdf",
        size_bytes=10,
        extracted_text="The contractor shall deliver reports weekly.",
    )
    db_session.add(ca)
    outline = json.dumps({"kind": "docx", "headings": ["Scope", "Deliverables"]})
    ta = TemplateAsset(
        workspace_id=workspace_id,
        storage_key="k2",
        filename="template.docx",
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size_bytes=100,
        extracted_outline_json=outline,
    )
    db_session.add(ta)
    db_session.commit()

    ctx, hints = build_generation_inputs(db_session, workspace_id)
    assert "brief.pdf" in ctx
    assert "weekly" in ctx
    assert "Scope" in hints
    assert "Deliverables" in hints


def test_assemble_prior_pipeline_text_only_includes_pipeline_markers(db_session, session_id):
    db_session.add(Message(session_id=session_id, role="assistant", content="Generic reply without marker."))
    db_session.add(
        Message(
            session_id=session_id,
            role="assistant",
            content="## Pipeline phase (1/5): Requirements Discovery Agent\n\nSome body",
        )
    )
    db_session.commit()
    merged = assemble_prior_pipeline_text(db_session, session_id)
    assert "Pipeline phase" in merged
    assert "Generic reply" not in merged
