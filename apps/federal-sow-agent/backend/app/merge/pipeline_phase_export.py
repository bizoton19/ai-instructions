"""After each pipeline phase, optionally write a merged Word file using the workspace template."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.merge.docx_merge import merge_or_standalone_docx, sow_model_to_flat
from app.models import PipelineArtifact, TemplateAsset, Workspace
from app.schemas import SOWSectionsModel
from app.storage import resolve_storage_key


def _sections_model_for_artifact(artifact: PipelineArtifact) -> SOWSectionsModel:
    try:
        data = json.loads(artifact.structured_data_json)
    except Exception:
        return SOWSectionsModel(full_markdown=artifact.full_markdown or "")
    try:
        return SOWSectionsModel.model_validate(data)
    except Exception:
        return SOWSectionsModel(full_markdown=artifact.full_markdown or "")


def try_write_merged_docx_for_phase(
    db: Session,
    workspace_id: str,
    session_id: str,
    artifact_id: str,
) -> tuple[str | None, str]:
    """
    If the workspace has an active template, merge this phase's structured output into Word
    and return (storage key relative to upload_dir, status note). Otherwise (None, reason).
    """
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws or not ws.active_template_asset_id:
        return None, "no active template"

    template = (
        db.query(TemplateAsset)
        .filter(TemplateAsset.id == ws.active_template_asset_id, TemplateAsset.workspace_id == workspace_id)
        .first()
    )
    if not template:
        return None, "active template record missing"

    artifact = db.query(PipelineArtifact).filter(PipelineArtifact.id == artifact_id).first()
    if not artifact or artifact.session_id != session_id:
        return None, "artifact not found"

    sections = _sections_model_for_artifact(artifact)
    if not (sections.full_markdown or "").strip() and not any(
        str(getattr(sections, k, "") or "").strip()
        for k in (
            "purpose",
            "background",
            "scope",
            "deliverables",
            "period_of_performance",
            "roles_and_responsibilities",
            "acceptance_criteria",
            "assumptions_and_constraints",
        )
    ):
        return None, "empty phase content"

    template_path = resolve_storage_key(template.storage_key)
    if not template_path.is_file():
        return None, "template file missing on disk"

    flat = sow_model_to_flat(sections)
    out_name = f"{uuid.uuid4().hex}_phase{artifact.phase_order}_{artifact.agent_id}_{session_id[:8]}.docx"
    out_path = settings.upload_dir / "outputs" / out_name
    note = merge_or_standalone_docx(template_path, template.filename, flat, out_path)
    key = f"outputs/{out_name}"
    return key, note


def delete_merged_docx_file(storage_key: str | None) -> None:
    if not storage_key:
        return
    path = resolve_storage_key(storage_key)
    if path.is_file():
        path.unlink(missing_ok=True)
