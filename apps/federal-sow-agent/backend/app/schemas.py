from datetime import datetime

from pydantic import BaseModel, Field


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


class AgentSessionOut(BaseModel):
    id: str
    workspace_id: str
    title: str
    agent_type: str
    status: str
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


class MergeIn(BaseModel):
    template_asset_id: str
    sections: SOWSectionsModel | None = None
    use_latest_generation: bool = True
