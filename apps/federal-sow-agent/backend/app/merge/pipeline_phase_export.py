"""After each pipeline phase, optionally write Word export derived from artifact content."""

from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.merge.artifact_word_flat import flat_context_from_pipeline_artifact
from app.merge.docx_merge import merge_or_standalone_docx, standalone_docx_from_flat
from app.models import PipelineArtifact, TemplateAsset, Workspace
from app.observability_events import record_event
from app.storage import resolve_storage_key

_SOW_SHAPE_KEYS = (
    "purpose",
    "background",
    "scope",
    "deliverables",
    "period_of_performance",
    "roles_and_responsibilities",
    "acceptance_criteria",
    "assumptions_and_constraints",
    "full_markdown",
)


def _artifact_has_exportable_body(flat: dict[str, str]) -> bool:
    fm = (flat.get("full_markdown") or "").strip()
    if fm:
        return True
    return any(str(flat.get(k, "") or "").strip() for k in _SOW_SHAPE_KEYS if k != "full_markdown")


def try_write_merged_docx_for_phase(
    db: Session,
    workspace_id: str,
    session_id: str,
    artifact_id: str,
) -> tuple[str | None, str]:
    """Write specialist output to Word. Returns ``(relative_storage_key_or_None, note)``."""
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        return None, "workspace not found"

    artifact = db.query(PipelineArtifact).filter(PipelineArtifact.id == artifact_id).first()
    if not artifact or artifact.session_id != session_id:
        return None, "artifact not found"

    flat = flat_context_from_pipeline_artifact(artifact)
    if not _artifact_has_exportable_body(flat):
        return None, "empty phase content"

    out_name = f"{uuid.uuid4().hex}_phase{artifact.phase_order}_{artifact.agent_id}_{session_id[:8]}.docx"
    out_path = settings.upload_dir / "outputs" / out_name

    if not ws.active_template_asset_id:
        try:
            preamble = (
                "No active Word template is set for this workspace. This file contains the specialist phase output only. "
                "Upload a .docx template and set it as active to reference your agency layout in export."
            )
            note = standalone_docx_from_flat(flat, out_path, preamble=preamble)
            key = f"outputs/{out_name}"
            record_event(
                "info",
                "merge",
                "Pipeline phase written to standalone Word (no template)",
                agent_id=artifact.agent_id,
                phase_order=str(artifact.phase_order),
                session_id=session_id[:8],
            )
            return key, note
        except Exception as exc:
            record_event(
                "error",
                "merge",
                "Standalone Word export failed for pipeline phase",
                detail=str(exc)[:400],
                agent_id=artifact.agent_id,
                phase_order=str(artifact.phase_order),
                session_id=session_id[:8],
            )
            return None, f"Word export error: {exc!s}"[:200]

    template = (
        db.query(TemplateAsset)
        .filter(TemplateAsset.id == ws.active_template_asset_id, TemplateAsset.workspace_id == workspace_id)
        .first()
    )
    if not template:
        return None, "active template record missing"

    template_path = resolve_storage_key(template.storage_key)
    if not template_path.is_file():
        return None, "template file missing on disk"

    try:
        note = merge_or_standalone_docx(template_path, template.filename, flat, out_path)
        key = f"outputs/{out_name}"
        record_event(
            "info",
            "merge",
            "Pipeline phase exported to Word",
            agent_id=artifact.agent_id,
            phase_order=str(artifact.phase_order),
            session_id=session_id[:8],
        )
        return key, note
    except Exception as exc:
        record_event(
            "error",
            "merge",
            "Word export failed for pipeline phase",
            detail=str(exc)[:400],
            agent_id=artifact.agent_id,
            phase_order=str(artifact.phase_order),
            session_id=session_id[:8],
        )
        return None, f"Word export error: {exc!s}"[:200]


def delete_merged_docx_file(storage_key: str | None) -> None:
    if not storage_key:
        return
    path = resolve_storage_key(storage_key)
    if path.is_file():
        path.unlink(missing_ok=True)
