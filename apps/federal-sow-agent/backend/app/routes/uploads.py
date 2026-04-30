from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.ingestion.dispatch import ingest_context_file, normalize_mime
from app.models import ContextAsset, TemplateAsset
from app.schemas import ContextAssetOut, TemplateAssetOut
from app.storage import save_upload_bytes
from app.template_outline import build_template_outline_json
from app.workspace_access import must_workspace_exist

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["uploads"])

_ALLOWED_TEMPLATE_SUFFIXES = (".docx", ".pdf", ".xlsx")


@router.post("/templates/upload", response_model=TemplateAssetOut)
async def upload_template(
    workspace_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    ws = must_workspace_exist(db, workspace_id)
    lower = file.filename.lower()
    if not lower.endswith(_ALLOWED_TEMPLATE_SUFFIXES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Templates must be {_ALLOWED_TEMPLATE_SUFFIXES[0]}, {_ALLOWED_TEMPLATE_SUFFIXES[1]}, or {_ALLOWED_TEMPLATE_SUFFIXES[2]}. "
            "PDF and Excel are used as drafting references; Word export still produces a new .docx from generated content.",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds max upload size")
    key, path = save_upload_bytes("templates", file.filename, data)
    mime = normalize_mime(file.filename, file.content_type)
    try:
        outline_json = build_template_outline_json(path, file.filename)
    except Exception as exc:
        outline_json = json.dumps({"kind": "error", "detail": str(exc)[:500]})
    item = TemplateAsset(
        workspace_id=workspace_id,
        storage_key=key,
        filename=file.filename,
        mime_type=mime,
        size_bytes=len(data),
        extracted_outline_json=outline_json,
    )
    db.add(item)
    db.flush()
    if not ws.active_template_asset_id:
        ws.active_template_asset_id = item.id
    db.commit()
    db.refresh(item)
    return item


@router.get("/templates", response_model=list[TemplateAssetOut])
def list_templates(workspace_id: str, db: Session = Depends(get_db)):
    must_workspace_exist(db, workspace_id)
    return db.query(TemplateAsset).filter(TemplateAsset.workspace_id == workspace_id).order_by(TemplateAsset.created_at.desc()).all()


@router.post("/context/upload", response_model=ContextAssetOut)
async def upload_context(
    workspace_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    must_workspace_exist(db, workspace_id)
    
    valid_extensions = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".md", ".markdown", ".txt")
    lower_filename = file.filename.lower()
    
    # We also allow image mimetypes
    is_valid = lower_filename.endswith(valid_extensions) or file.content_type.startswith("image/")
    if not is_valid:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type for context: {file.filename}")

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
def list_context(workspace_id: str, db: Session = Depends(get_db)):
    must_workspace_exist(db, workspace_id)
    return db.query(ContextAsset).filter(ContextAsset.workspace_id == workspace_id).order_by(ContextAsset.created_at.desc()).all()


@router.delete("/context/{asset_id}")
def delete_context_asset(workspace_id: str, asset_id: str, db: Session = Depends(get_db)):
    must_workspace_exist(db, workspace_id)
    item = db.query(ContextAsset).filter(ContextAsset.workspace_id == workspace_id, ContextAsset.id == asset_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Context asset not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.delete("/templates/{asset_id}")
def delete_template_asset(workspace_id: str, asset_id: str, db: Session = Depends(get_db)):
    ws = must_workspace_exist(db, workspace_id)
    item = db.query(TemplateAsset).filter(TemplateAsset.workspace_id == workspace_id, TemplateAsset.id == asset_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template asset not found")
    db.delete(item)
    db.flush()
    if ws.active_template_asset_id == asset_id:
        replacement = (
            db.query(TemplateAsset)
            .filter(TemplateAsset.workspace_id == workspace_id)
            .order_by(TemplateAsset.created_at.desc())
            .first()
        )
        ws.active_template_asset_id = replacement.id if replacement else None
    db.commit()
    return {"ok": True}


@router.post("/templates/{asset_id}/activate")
def activate_template(workspace_id: str, asset_id: str, db: Session = Depends(get_db)):
    ws = must_workspace_exist(db, workspace_id)
    item = db.query(TemplateAsset).filter(TemplateAsset.workspace_id == workspace_id, TemplateAsset.id == asset_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template asset not found")
    ws.active_template_asset_id = item.id
    db.commit()
    return {"ok": True, "active_template_asset_id": item.id}

