from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: UUID
    email: str

    model_config = {"from_attributes": True}


class LoginIn(BaseModel):
    email: str
    password: str


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class WorkspaceOut(BaseModel):
    id: UUID
    name: str
    owner_user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionCreate(BaseModel):
    title: str | None = Field(default="New session", max_length=255)


class AgentSessionOut(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class TemplateAssetOut(BaseModel):
    id: UUID
    workspace_id: UUID
    filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ContextAssetOut(BaseModel):
    id: UUID
    workspace_id: UUID
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
    template_asset_id: UUID
    sections: SOWSectionsModel | None = None
    use_latest_generation: bool = True
