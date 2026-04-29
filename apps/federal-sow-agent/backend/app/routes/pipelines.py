from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AgentSession
from app.pipeline_runner import advance_pipeline, reset_pipeline
from app.pipeline_runner import snapshot as pipeline_snapshot
from app.schemas import PipelineAdvanceIn, PipelineAdvanceOut

router = APIRouter(
    prefix="/workspaces/{workspace_id}/sessions/{session_id}/pipeline",
    tags=["pipeline"],
)


@router.post("/advance", response_model=PipelineAdvanceOut)
def pipeline_advance(
    workspace_id: str,
    session_id: str,
    body: PipelineAdvanceIn,
    db: Session = Depends(get_db),
):
    bad, payload = advance_pipeline(db, workspace_id, session_id, body)
    if bad:
        raise HTTPException(status_code=bad["status_code"], detail=bad["detail"])
    return PipelineAdvanceOut.model_validate(payload)


@router.post("/reset", response_model=PipelineAdvanceOut)
def pipeline_reset(workspace_id: str, session_id: str, db: Session = Depends(get_db)):
    session = (
        db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    reset_pipeline(session, db)
    db.refresh(session)
    payload = pipeline_snapshot(session)
    payload.setdefault("warnings", [])
    payload.setdefault("sections", None)
    payload.setdefault("phase_name_run", None)
    payload.setdefault("phases_run", 0)
    payload.setdefault("pipeline_artifact_count", 0)
    return PipelineAdvanceOut.model_validate(payload)
