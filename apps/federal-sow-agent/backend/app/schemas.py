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
    agent_temperature: float = 0.2
    agent_workspace_instructions: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceAgentSettingsPatch(BaseModel):
    agent_temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    agent_workspace_instructions: str | None = Field(default=None, max_length=8000)


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


# =============================================================================
# PHASE-SPECIFIC ARTIFACT SCHEMAS
# Each pipeline phase produces a distinct document type
# =============================================================================

class RequirementsDiscoveryModel(BaseModel):
    """Phase 1: Requirements Discovery Agent output.
    
    Produces a Requirements Clarification Document that identifies
    gaps, asks SMART questions, and summarizes known requirements.
    """
    executive_summary: str = Field(default="", description="Brief summary of current understanding")
    key_objectives: list[str] = Field(default_factory=list, description="Key objectives like newspaper headlines")
    known_requirements: list[dict] = Field(default_factory=list, description="Requirements identified so far with SMART assessment")
    clarification_questions: list[str] = Field(default_factory=list, description="Questions to ask the customer")
    gaps_and_risks: list[str] = Field(default_factory=list, description="Identified gaps, ambiguities, or risks")
    stakeholder_recommendations: list[str] = Field(default_factory=list, description="Recommendations for stakeholder involvement")
    full_markdown: str = Field(default="", description="Complete Requirements Clarification Document in Markdown")


class RequirementsAnalystModel(BaseModel):
    """Phase 2: Requirements Analyst output.
    
    Produces a System Requirements Document (SRD) or Performance Requirements
    Summary (PRS) with verifiable, measurable requirements.
    """
    document_title: str = Field(default="", description="Title of the requirements document")
    version: str = Field(default="1.0", description="Document version")
    system_overview: str = Field(default="", description="High-level system description")
    functional_requirements: list[dict] = Field(default_factory=list, description="Functional requirements with IDs and verification methods")
    non_functional_requirements: list[dict] = Field(default_factory=list, description="Performance, security, reliability requirements")
    interface_requirements: list[dict] = Field(default_factory=list, description="System interfaces and integrations")
    acceptance_criteria: list[dict] = Field(default_factory=list, description="Testable acceptance criteria per requirement")
    requirement_traceability_matrix: list[dict] = Field(default_factory=list, description="Traceability from business need to requirement")
    assumptions_and_dependencies: list[str] = Field(default_factory=list, description="Assumptions and external dependencies")
    full_markdown: str = Field(default="", description="Complete SRD/PRS in Markdown with requirement tables")


class MarketResearchModel(BaseModel):
    """Phase 3: Market Research Analyst output.
    
    Produces a Market Research Report per FAR Part 10 analyzing
    commercial availability, competition, and industry practices.
    """
    report_title: str = Field(default="", description="Title of the market research report")
    research_date: str = Field(default="", description="Date of research")
    executive_summary: str = Field(default="", description="Key findings summary")
    industry_overview: str = Field(default="", description="Description of relevant industry/market")
    commercial_item_availability: list[dict] = Field(default_factory=list, description="Commercial items/services available")
    vendor_landscape: list[dict] = Field(default_factory=list, description="Potential vendors and their capabilities")
    small_business_analysis: dict = Field(default_factory=dict, description="Small business set-aside feasibility")
    competitive_analysis: str = Field(default="", description="Level of competition assessment")
    pricing_trends: str = Field(default="", description="Observed pricing patterns in the market")
    sustainability_considerations: list[str] = Field(default_factory=list, description="Green procurement opportunities")
    acquisition_strategy_recommendations: list[str] = Field(default_factory=list, description="Recommended acquisition approach")
    full_markdown: str = Field(default="", description="Complete Market Research Report in Markdown")


class SOWSectionsModel(BaseModel):
    """Phase 4: SOW Writer output.
    
    Produces a Statement of Work (SOW) or Performance Work Statement (PWS)
    defining exactly how and when the contractor will perform.
    """
    purpose: str = Field(default="", description="Purpose of the contract")
    background: str = Field(default="", description="Background and context")
    scope: str = Field(default="", description="Detailed scope of work")
    deliverables: str = Field(default="", description="Specific deliverables with quantities")
    period_of_performance: str = Field(default="", description="Timeline, phases, milestones")
    roles_and_responsibilities: str = Field(default="", description="Government and contractor responsibilities")
    acceptance_criteria: str = Field(default="", description="Standards for accepting deliverables")
    assumptions_and_constraints: str = Field(default="", description="Assumptions and limiting factors")
    full_markdown: str = Field(default="", description="Complete SOW/PWS document in Markdown")


class IGCECostModel(BaseModel):
    """Phase 5: Cost Estimator output.
    
    Produces an Independent Government Cost Estimate (IGCE) with
    detailed cost breakdowns, rationale, and risk analysis.
    """
    estimate_title: str = Field(default="", description="Title of the IGCE")
    estimate_date: str = Field(default="", description="Date of estimate")
    basis_of_estimate: str = Field(default="", description="Methodology and data sources used")
    labor_categories: list[dict] = Field(default_factory=list, description="Labor categories with hours and rates")
    labor_subtotal: float = Field(default=0.0, description="Total labor cost")
    material_equipment_costs: list[dict] = Field(default_factory=list, description="Materials, equipment, supplies")
    material_subtotal: float = Field(default=0.0, description="Total material cost")
    other_direct_costs: list[dict] = Field(default_factory=list, description="Travel, training, special tests")
    odc_subtotal: float = Field(default=0.0, description="Total ODC")
    indirect_costs: list[dict] = Field(default_factory=list, description="Overhead, G&A, fee structures")
    total_estimate: float = Field(default=0.0, description="Total IGCE amount")
    cost_risk_analysis: str = Field(default="", description="Confidence level and risk factors")
    comparison_to_independent_sources: str = Field(default="", description="Comparison to historical data or independent estimates")
    assumptions_and_limitations: list[str] = Field(default_factory=list, description="Key assumptions and estimate limitations")
    full_markdown: str = Field(default="", description="Complete IGCE narrative with tables in Markdown")


# Union type for pipeline artifact responses
PipelineArtifactModel = RequirementsDiscoveryModel | RequirementsAnalystModel | MarketResearchModel | SOWSectionsModel | IGCECostModel


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


class PipelineArtifactOut(BaseModel):
    """Output schema for pipeline phase artifacts."""
    phase_order: int
    phase_name: str
    agent_id: str
    artifact_type: str  # requirements_discovery | requirements_analyst | market_research | sow_writer | cost_estimator
    artifact_filename: str
    created_at: datetime
    summary: str  # Brief preview of content
    download_url: str | None = None


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
    artifact_produced: str | None = Field(default=None, description="Type of artifact produced in this phase")
    latest_artifact_filename: str | None = Field(
        default=None, description="Suggested download filename for the artifact from the last completed phase."
    )


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
    use_all_pipeline_phases: bool = Field(
        default=False,
        description="Markdown only: concatenate every pipeline-phase assistant message in order.",
    )


class PipelineArtifactDownloadOut(BaseModel):
    """Response for downloading a specific phase artifact."""
    phase_name: str
    artifact_type: str
    filename: str
    content_type: str
    content: str  # Markdown content
    generated_at: datetime
