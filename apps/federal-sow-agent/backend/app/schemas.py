from datetime import datetime

from pydantic import BaseModel, Field


class AgentBrief(BaseModel):
    """Catalog entry exposed to clients (system prompts remain server-side)."""

    id: str
    name: str
    description: str


class UserOut(BaseModel):
    id: str
    email: str

    model_config = {"from_attributes": True}


class LoginIn(BaseModel):
    email: str
    password: str


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class WorkspaceOut(BaseModel):
    id: str
    name: str
    owner_user_id: str
    active_template_asset_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionCreate(BaseModel):
    title: str | None = Field(default="New session", max_length=255)
    agent_type: str | None = Field(default="sow_writer", max_length=64)


class SessionUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    agent_type: str | None = Field(default=None, max_length=64)
    orchestration_mode: str | None = Field(default=None, max_length=32)


class AgentSessionOut(BaseModel):
    id: str
    workspace_id: str
    title: str
    agent_type: str
    status: str
    orchestration_mode: str = "manual_review"
    pipeline_step: int = 0
    pipeline_paused: bool = False
    pipeline_completed: bool = False
    needs_user_clarification: bool = False
    pipeline_artifact_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class TemplateAssetOut(BaseModel):
    id: str
    workspace_id: str
    filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ContextAssetOut(BaseModel):
    id: str
    workspace_id: str
    filename: str
    mime_type: str
    kind: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateIn(BaseModel):
    """Optional extra instructions for this generation run."""

    additional_instructions: str | None = None


class SOWSectionsModel(BaseModel):
    """Structured SOW sections for template merge and UI."""

    purpose: str = ""
    background: str = ""
    scope: str = ""
    deliverables: str = ""
    period_of_performance: str = ""
    roles_and_responsibilities: str = ""
    acceptance_criteria: str = ""
    assumptions_and_constraints: str = ""
    full_markdown: str = ""


class GenerateOut(BaseModel):
    sections: SOWSectionsModel
    warnings: list[str] = []


class PipelineAdvanceIn(BaseModel):
    additional_instructions: str | None = Field(default=None, description="Instructions for upcoming pipeline phase.")
    approve_manual_gate: bool = Field(
        default=False,
        description="In manual_review, approve output from the completed phase before the next specialist runs.",
    )
    clarification_resolved: bool = Field(default=False)
    execution: str = Field(
        default="single_phase",
        description="single_phase | auto_chain — auto_chain runs sequentially until clarification or completion when orchestration_mode=automatic.",
    )


class PipelineAdvanceOut(BaseModel):
    orchestration_mode: str
    pipeline_step: int
    pipeline_total_phases: int
    pipeline_completed: bool
    pipeline_paused: bool
    needs_user_clarification: bool
    pipeline_artifact_count: int = 0
    sections: SOWSectionsModel | None = None
    warnings: list[str] = []
    phase_name_run: str | None = None
    phases_run: int = 0


class MergeIn(BaseModel):
    template_asset_id: str
    sections: SOWSectionsModel | None = None
    use_latest_generation: bool = True


class ExportIn(BaseModel):
    """Produce merged Word output when ``template_asset_id`` is set; otherwise Markdown."""

    template_asset_id: str | None = Field(
        default=None,
        description="Workspace template asset id for Word merge; omit for Markdown-only export.",
    )
    sections: SOWSectionsModel | None = None
    use_latest_generation: bool = True
