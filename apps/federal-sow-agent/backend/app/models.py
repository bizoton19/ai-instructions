import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    active_template_asset_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("template_assets.id"), nullable=True)
    specialist_template_map_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_temperature: Mapped[float] = mapped_column(Float, nullable=False, default=0.2, server_default="0.2")
    agent_workspace_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    sessions: Mapped[list["AgentSession"]] = relationship(back_populates="workspace")
    templates: Mapped[list["TemplateAsset"]] = relationship(
        back_populates="workspace", foreign_keys="[TemplateAsset.workspace_id]"
    )
    contexts: Mapped[list["ContextAsset"]] = relationship(back_populates="workspace")


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="New session")
    agent_type: Mapped[str] = mapped_column(String(64), nullable=False, default="sow_writer")
    # manual_review: pause after each phase until approve_manual_gate | automatic: run contiguous auto_chain phases
    orchestration_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="manual_review")
    pipeline_step: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pipeline_paused: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pipeline_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    needs_user_clarification: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pipeline_artifact_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(64), default="active")  # active | archived
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace: Mapped["Workspace"] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(back_populates="session")
    artifacts: Mapped[list["PipelineArtifact"]] = relationship(back_populates="session")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("agent_sessions.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # user | assistant | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["AgentSession"] = relationship(back_populates="messages")


class TemplateAsset(Base):
    __tablename__ = "template_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    extracted_outline_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    workspace: Mapped["Workspace"] = relationship(
        back_populates="templates", foreign_keys=[workspace_id]
    )


class ContextAsset(Base):
    __tablename__ = "context_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # pdf | docx | xlsx | csv | image | other
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    workspace: Mapped["Workspace"] = relationship(back_populates="contexts")


class ProcessingPipelineVersion(Base):
    """Internal versioning for ingestion pipelines (not exposed in standard UI)."""

    __tablename__ = "processing_pipeline_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PipelineArtifact(Base):
    """Stores distinct artifacts produced by each pipeline phase.
    
    Each phase of the pipeline produces a specific document type:
    - requirements_agent: Requirements Clarification Document
    - requirements_analyst: System Requirements Document (SRD)
    - market_research: Market Research Report
    - sow_writer: Statement of Work (SOW)
    - cost_estimator: Independent Government Cost Estimate (IGCE)
    """

    __tablename__ = "pipeline_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("agent_sessions.id"), nullable=False, index=True)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    
    # Phase identification
    phase_order: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-4 for the 5 phases
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g., "requirements_agent"
    agent_name: Mapped[str] = mapped_column(String(255), nullable=False)  # Human-readable name
    
    # Artifact metadata
    artifact_type: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g., "requirements_discovery"
    artifact_filename: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g., "01_requirements_clarification.md"
    artifact_description: Mapped[str] = mapped_column(String(512), nullable=False)  # Human description
    
    # Content storage (JSON for structured data, plus rendered Markdown)
    structured_data_json: Mapped[str] = mapped_column(Text, nullable=False)  # Pydantic model JSON
    full_markdown: Mapped[str] = mapped_column(Text, nullable=False)  # Rendered Markdown document
    
    # Summary for quick display
    content_summary: Mapped[str] = mapped_column(Text, nullable=True)  # Brief preview/summary

    # Optional merged Word export (relative key under upload dir, e.g. outputs/uuid_phase0_....docx)
    exported_docx_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    
    # Relationships
    session: Mapped["AgentSession"] = relationship(back_populates="artifacts")
