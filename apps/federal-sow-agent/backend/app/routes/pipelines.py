from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AgentSession, Workspace
from app.pipeline_zip import build_pipeline_artifacts_zip_bytes
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
from app.storage import resolve_storage_key
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
            artifact_filename=a.artifact_filename,
            created_at=a.created_at,
            summary=a.content_summary or "Artifact generated",
            download_url=f"/workspaces/{workspace_id}/sessions/{session_id}/pipeline/artifacts/{a.phase_order}/download",
            merged_docx_download_url=(
                f"/workspaces/{workspace_id}/sessions/{session_id}/pipeline/artifacts/{a.phase_order}/merged-docx"
                if a.exported_docx_key
                else None
            ),
            word_export_note=a.exported_docx_note,
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


@router.get("/artifacts/{phase_order}/merged-docx")
def download_phase_merged_docx(
    workspace_id: str,
    session_id: str,
    phase_order: int,
    db: Session = Depends(get_db),
):
    """Download the Word file produced by merging this phase output with the workspace template (if generated)."""
    must_workspace_exist(db, workspace_id)
    session = (
        db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    artifact = get_artifact_by_phase(db, session_id, phase_order)
    if not artifact:
        raise HTTPException(status_code=404, detail=f"Artifact for phase {phase_order} not found")
    if not artifact.exported_docx_key:
        raise HTTPException(
            status_code=404,
            detail=(
                "No Word export for this phase yet. Re-run the specialist after fixing context, "
                "or see word_export_note on the artifact list."
            ),
        )

    path = resolve_storage_key(artifact.exported_docx_key)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Merged Word file missing on server")

    download_name = f"phase_{phase_order}_{artifact.agent_id}.docx"
    return FileResponse(
        path,
        filename=download_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/artifacts/package/download")
def download_artifacts_package_zip(
    workspace_id: str,
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    One ZIP containing separate files per phase (.md and optional .docx Word export) plus MANIFEST.txt.

    This is the primary “handoff package”; it does not concatenate all narrative into one Markdown file.
    """
    must_workspace_exist(db, workspace_id)
    session = (
        db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    artifacts = get_session_artifacts(db, session_id)
    if not artifacts:
        raise HTTPException(status_code=404, detail="No artifacts found for this session")

    ws_row = db.query(Workspace).filter(Workspace.id == session.workspace_id).first()
    tid = ws_row.active_template_asset_id if ws_row else None

    payload = build_pipeline_artifacts_zip_bytes(
        artifacts,
        workspace_id=workspace_id,
        session_id=session_id,
        active_template_asset_id=tid,
        resolve_storage_key=resolve_storage_key,
    )
    fname = f"session_{session_id[:8]}_pipeline_artifacts.zip"
    return Response(
        content=payload,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
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
