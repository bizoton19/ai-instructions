from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.merge.docx_merge import merge_or_standalone_docx, sow_model_to_flat, sow_sections_to_markdown
from app.models import AgentSession, Message, TemplateAsset
from app.schemas import ExportIn, MergeIn, SOWSectionsModel
from app.storage import resolve_storage_key
from app.workspace_access import must_workspace_exist

router = APIRouter(prefix="/workspaces/{workspace_id}/sessions/{session_id}", tags=["merge"])


def _load_session(db: Session, workspace_id: str, session_id: str) -> AgentSession:
    session = db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


def _word_export(template_path: Path, template_filename: str, flat: dict[str, str], out_path: Path) -> str:
    """DOCX templates merge in place; PDF/Excel guides drafting but export is a standalone .docx."""
    return merge_or_standalone_docx(template_path, template_filename, flat, out_path)


def _sections_have_exportable_body(s: SOWSectionsModel) -> bool:
    if (s.full_markdown or "").strip():
        return True
    data = {k: v for k, v in s.model_dump().items() if k != "full_markdown"}
    return any(str(v).strip() for v in data.values())


def _pipeline_phase_assistant_bodies(db: Session, session_id: str) -> list[str]:
    """Ordered assistant messages produced by the multi-phase pipeline (each starts with a phase header)."""
    marker = "## Pipeline phase"
    msgs = (
        db.query(Message)
        .filter(Message.session_id == session_id, Message.role == "assistant")
        .order_by(Message.created_at.asc())
        .all()
    )
    out: list[str] = []
    for m in msgs:
        body = (m.content or "").strip()
        if body and marker in body:
            out.append(body)
    return out


def _resolve_sections(db: Session, session: AgentSession, payload: MergeIn | ExportIn) -> SOWSectionsModel:
    if payload.sections is not None:
        return payload.sections
    if payload.use_latest_generation:
        latest = db.query(Message).filter(Message.session_id == session.id, Message.role == "assistant").order_by(Message.created_at.desc()).first()
        if not latest:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No generated SOW found")
        return SOWSectionsModel(full_markdown=latest.content)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sections required when not using latest generation")


@router.post("/merge")
def merge_sow_docx(
    workspace_id: str,
    session_id: str,
    payload: MergeIn,
    db: Session = Depends(get_db),
):
    """Pack generated content into Word: merge with a .docx template, or standalone .docx if template is PDF/XLSX."""

    must_workspace_exist(db, workspace_id)
    session = _load_session(db, workspace_id, session_id)

    template = db.query(TemplateAsset).filter(
        TemplateAsset.id == payload.template_asset_id,
        TemplateAsset.workspace_id == workspace_id,
    ).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    template_path = resolve_storage_key(template.storage_key)
    if not template_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template file missing")

    sections = _resolve_sections(db, session, payload)
    flat = sow_model_to_flat(sections)
    suffix = Path(template.filename).suffix.lower()
    out_name = f"{uuid.uuid4().hex}_export.docx" if suffix != ".docx" else f"{uuid.uuid4().hex}_merged_{template.filename}"
    out_path = Path(template_path.parent.parent / "outputs" / out_name)
    note = _word_export(template_path, template.filename, flat, out_path)

    rel = f"/workspaces/{workspace_id}/sessions/{session_id}/downloads/{out_name}"
    return {"download_path": rel, "format": "docx", "note": note}


@router.post("/export")
def export_document(
    workspace_id: str,
    session_id: str,
    payload: ExportIn,
    db: Session = Depends(get_db),
):
    """
    If ``template_asset_id`` is set, merges into Word using the latest structured or assistant draft.
    If omitted, writes Markdown—optionally concatenating every ``## Pipeline phase`` assistant message when
    ``use_all_pipeline_phases`` is true.
    """

    must_workspace_exist(db, workspace_id)
    session = _load_session(db, workspace_id, session_id)

    base_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "outputs"
    base_dir.mkdir(parents=True, exist_ok=True)

    if payload.template_asset_id:
        sections = _resolve_sections(db, session, payload)
        template = db.query(TemplateAsset).filter(
            TemplateAsset.id == payload.template_asset_id,
            TemplateAsset.workspace_id == workspace_id,
        ).first()
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        template_path = resolve_storage_key(template.storage_key)
        if not template_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template file missing")
        flat = sow_model_to_flat(sections)
        suffix = Path(template.filename).suffix.lower()
        out_name = f"{uuid.uuid4().hex}_export.docx" if suffix != ".docx" else f"{uuid.uuid4().hex}_merged_{template.filename}"
        out_path = base_dir / out_name
        note = _word_export(template_path, template.filename, flat, out_path)
        rel = f"/workspaces/{workspace_id}/sessions/{session_id}/downloads/{out_name}"
        return {"download_path": rel, "format": "docx", "note": note}

    used_pipeline_concat = False
    md_body: str
    if payload.use_all_pipeline_phases:
        bodies = _pipeline_phase_assistant_bodies(db, session.id)
        if bodies:
            md_body = "\n\n---\n\n".join(bodies)
            used_pipeline_concat = True
        else:
            sections = _resolve_sections(db, session, payload)
            if not _sections_have_exportable_body(sections):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No generated narrative to export")
            md_body = sow_sections_to_markdown(sections)
    else:
        sections = _resolve_sections(db, session, payload)
        if not _sections_have_exportable_body(sections):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No generated narrative to export")
        md_body = sow_sections_to_markdown(sections)

    out_name = (
        f"{uuid.uuid4().hex}_pipeline_artifacts_{session_id[:8]}.md"
        if used_pipeline_concat
        else f"{uuid.uuid4().hex}_export_{session_id[:8]}.md"
    )
    out_path = base_dir / out_name
    out_path.write_text(md_body, encoding="utf-8")
    rel = f"/workspaces/{workspace_id}/sessions/{session_id}/downloads/{out_name}"
    note = (
        "Markdown export includes every completed pipeline phase in this session."
        if used_pipeline_concat
        else "Markdown export generated from structured sections."
    )
    return {"download_path": rel, "format": "markdown", "note": note}


@router.get("/downloads/{filename}")
def download_file(filename: str):
    base = Path(__file__).resolve().parent.parent.parent / "uploads" / "outputs"
    path = base / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    mime = (
        "text/markdown;charset=utf-8"
        if path.suffix.lower() == ".md"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    return FileResponse(path, filename=filename, media_type=mime)

