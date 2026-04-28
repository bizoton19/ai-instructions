from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.config import settings
from app.ingestion.dispatch import ingest_context_file, normalize_mime
from app.ingestion.docx_extract import extract_docx_text_and_outline
from app.models import ContextAsset, TemplateAsset, Workspace
from app.schemas import ContextAssetOut, TemplateAssetOut
from app.storage import save_upload_bytes

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["uploads"])


def _must_workspace(db: Session, workspace_id: UUID, user_id: UUID) -> Workspace:
    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.owner_user_id == user_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws


@router.post("/templates/upload", response_model=TemplateAssetOut)
async def upload_template(
    workspace_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _must_workspace(db, workspace_id, user.id)
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds max upload size")
    key, path = save_upload_bytes("templates", file.filename, data)
    mime = normalize_mime(file.filename, file.content_type)
    outline_json = None
    if file.filename.lower().endswith(".docx"):
        _, outline = extract_docx_text_and_outline(path)
        outline_json = json.dumps({"headings": outline})
    item = TemplateAsset(
        workspace_id=workspace_id,
        storage_key=key,
        filename=file.filename,
        mime_type=mime,
        size_bytes=len(data),
        extracted_outline_json=outline_json,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/templates", response_model=list[TemplateAssetOut])
def list_templates(workspace_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    _must_workspace(db, workspace_id, user.id)
    return db.query(TemplateAsset).filter(TemplateAsset.workspace_id == workspace_id).order_by(TemplateAsset.created_at.desc()).all()


@router.post("/context/upload", response_model=ContextAssetOut)
async def upload_context(
    workspace_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _must_workspace(db, workspace_id, user.id)
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds max upload size")
    key, path = save_upload_bytes("context", file.filename, data)
    mime = normalize_mime(file.filename, file.content_type)
    kind, text, meta = ingest_context_file(path, file.filename, mime)
    item = ContextAsset(
        workspace_id=workspace_id,
        storage_key=key,
        filename=file.filename,
        mime_type=mime,
        kind=kind,
        size_bytes=len(data),
        extracted_text=text[:400000],
        extraction_meta_json=json.dumps(meta),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/context", response_model=list[ContextAssetOut])
def list_context(workspace_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    _must_workspace(db, workspace_id, user.id)
    return db.query(ContextAsset).filter(ContextAsset.workspace_id == workspace_id).order_by(ContextAsset.created_at.desc()).all()

