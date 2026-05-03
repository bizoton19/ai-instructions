from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AgentSession, PipelineArtifact
from app.pipeline_runner import (
    advance_pipeline,
    get_session_artifacts,
    reset_pipeline,
    get_artifact_by_phase,
)
from app.pipeline_runner import snapshot as pipeline_snapshot
from app.schemas import (
    PipelineAdvanceIn,
    PipelineAdvanceOut,
    PipelineArtifactOut,
    PipelineArtifactDownloadOut,
)
from app.workspace_access import must_workspace_exist

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
    must_workspace_exist(db, workspace_id)
    bad, payload = advance_pipeline(db, workspace_id, session_id, body)
    if bad:
        raise HTTPException(status_code=bad["status_code"], detail=bad["detail"])
    return PipelineAdvanceOut.model_validate(payload)


@router.post("/reset", response_model=PipelineAdvanceOut)
def pipeline_reset(workspace_id: str, session_id: str, db: Session = Depends(get_db)):
    must_workspace_exist(db, workspace_id)
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


@router.get("/artifacts", response_model=list[PipelineArtifactOut])
def list_pipeline_artifacts(
    workspace_id: str,
    session_id: str,
    db: Session = Depends(get_db),
):
    """List all artifacts produced by the pipeline for this session."""
    must_workspace_exist(db, workspace_id)
    session = (
        db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    artifacts = get_session_artifacts(db, session_id)
    return [
        PipelineArtifactOut(
            phase_order=a.phase_order,
            phase_name=a.agent_name,
            agent_id=a.agent_id,
            artifact_type=a.artifact_type,
            created_at=a.created_at,
            summary=a.content_summary or "Artifact generated",
            download_url=f"/api/workspaces/{workspace_id}/sessions/{session_id}/pipeline/artifacts/{a.phase_order}",
        )
        for a in artifacts
    ]


@router.get("/artifacts/{phase_order}", response_model=PipelineArtifactDownloadOut)
def get_artifact(
    workspace_id: str,
    session_id: str,
    phase_order: int,
    db: Session = Depends(get_db),
):
    """Download a specific phase artifact as Markdown."""
    must_workspace_exist(db, workspace_id)
    session = (
        db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    artifact = get_artifact_by_phase(db, session_id, phase_order)
    if not artifact:
        raise HTTPException(status_code=404, detail=f"Artifact for phase {phase_order} not found")
    
    return PipelineArtifactDownloadOut(
        phase_name=artifact.agent_name,
        artifact_type=artifact.artifact_type,
        filename=artifact.artifact_filename,
        content_type="text/markdown",
        content=artifact.full_markdown,
        generated_at=artifact.created_at,
    )


@router.get("/artifacts/{phase_order}/download")
def download_artifact_file(
    workspace_id: str,
    session_id: str,
    phase_order: int,
    db: Session = Depends(get_db),
):
    """Download a specific phase artifact as a Markdown file."""
    must_workspace_exist(db, workspace_id)
    session = (
        db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    artifact = get_artifact_by_phase(db, session_id, phase_order)
    if not artifact:
        raise HTTPException(status_code=404, detail=f"Artifact for phase {phase_order} not found")
    
    return PlainTextResponse(
        content=artifact.full_markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{artifact.artifact_filename}"'},
    )


@router.get("/artifacts/all/download")
def download_all_artifacts(
    workspace_id: str,
    session_id: str,
    db: Session = Depends(get_db),
):
    """Download all phase artifacts as a combined Markdown file."""
    must_workspace_exist(db, workspace_id)
    session = (
        db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    artifacts = get_session_artifacts(db, session_id)
    if not artifacts:
        raise HTTPException(status_code=404, detail="No artifacts found for this session")
    
    combined = []
    for artifact in artifacts:
        combined.append(f"# {artifact.agent_name}\n")
        combined.append(f"**Type:** {artifact.artifact_description}\n")
        combined.append(f"**Generated:** {artifact.created_at.isoformat()}\n\n")
        combined.append(artifact.full_markdown)
        combined.append("\n\n---\n\n")
    
    return PlainTextResponse(
        content="\n".join(combined),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="complete_pipeline_artifacts.md"'},
    )
