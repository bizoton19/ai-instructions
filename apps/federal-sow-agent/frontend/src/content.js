/**
 * Central UI copy for the Federal SOW Agent frontend.
 * Edit this file to change titles, labels, and instructional text without touching components.
 */

export const content = {
  toastPrefix: "//",

  header: {
    appTitle: "Contextual Document Writer",
    userBadge: "System Active",
    settingsButtonTitle: "Workspace agent settings",
  },

  settings: {
    panelTitle: "Workspace agent settings",
    temperatureLabel: "Model temperature",
    temperatureHint:
      "Lower (about 0.1 to 0.3) is steadier; higher (0.6 to 1.0) can yield more variety at the cost of precision. The deployed model name is set on the server.",
    guidanceLabel: "Workspace-wide instructions",
    guidanceHint: "These lines are added before every generate and pipeline step in this workspace.",
    save: "Save workspace settings",
    cancel: "Close",
    smartsExplainer:
      "Each specialist uses the server’s prompt and your workspace context. Stronger results usually come from richer source files, clearer synthesis notes, and picking the right specialist. This panel only adjusts sampling temperature and default instructions for this workspace.",
  },

  auth: {
    /** Shell-only preview; replace when real identity is wired in. */
    displayName: "J. Rivera",
    displayEmail: "j.rivera@agency.gov",
    initialsHint: "User avatar (initials)",
    placeholderNote: "Sign-in preview only",
  },

  prompts: {
    workspaceName: "Workspace name",
    defaultWorkspaceName: "Default Workspace",
    newSessionTitle: "New Session",
    renameWorkspace: "Rename workspace",
    renameSession: "Rename session",
    renameFile: "Rename file",
  },

  notices: {
    uploadedContextFiles: (count) => `Uploaded ${count} context file(s).`,
    uploadedTemplateFiles: (count) => `Uploaded ${count} template file(s).`,
    activeTemplateUpdated: "Active template updated.",
    draftGenerationSuccessful: "Draft Generation Successful.",
    exportReady: "Export ready.",
    markdownExportReady: "Markdown file ready to download.",
    sessionPackageReady:
      "Session package downloaded — a ZIP folder with separate files per phase (Markdown, Word exports when present, and MANIFEST.txt).",
    artifactsExportReady: "Combined Markdown download ready (single file — use for quick search only).",
  },

  sidebar: {
    title: "Workspaces",
    sessionsSubtitle: "Agent sessions for this workspace",
    newWorkspaceTitle: "Initialize Workspace",
    newSessionTitle: "New Session",
    newSessionNamePrompt: "Enter a name for this session:",
    contextMenuRename: "Rename",
    contextMenuDeleteWorkspace: "Delete workspace",
    deleteWorkspaceConfirm: (name) =>
      `Delete workspace “${name}” and all sessions, context files, templates, and stored artifacts? This cannot be undone.`,
    noSessions: "No sessions yet.",
    createSessionCta: "Create session",
    handOffNote:
      "New sessions reuse the specialist on the selected session when you click plus. The dropdown specialist controls single-step Generate only. The specialist pipeline chooses its own sequence on the synthesis step, so you can leave the toolbar specialist unchanged when you rely on the pipeline.",
  },

  toolbar: {
    statContext: "CONTEXT",
    statTemplates: "TEMPLATES",
    statSessions: "SESSIONS",
    statArtifacts: "ARTIFACTS",
    pipeline: "Pipeline",
    storage: "Storage",
    observability: "Observability",
    specialistBadge: "Session specialist",
    specialistUnset: "(select a session)",
    specialistSelectTitle: "Change specialist for drafts and standalone Generate draft",
  },

  agents: {
    draftingStatus: (specialistLabel) =>
      `${specialistLabel} is drafting. This is a single model run for this session.`,
    pipelineRunning: "Pipeline specialists are drafting (server-side orchestration).",
    exportingStatus: "Generating Word export.",
    markdownExportStatus: "Generating Markdown export.",
    sessionPackageZipStatus: "Building session artifact package (ZIP).",
    artifactsExportStatus: "Combining all pipeline phases into one Markdown file.",
    ingestStatus: "Uploading workspace files.",
  },

  wizard: {
    progressAria: "Wizard steps for this pipeline",

    /** Visible steps: short label + tooltip + one-line subtitle for the caption */
    stepNav: [
      {
        short: "Overview",
        title: "Initialization",
        tooltip: "What this workflow does before you upload anything.",
        subtitle: "Understand how context, templates, and synthesis combine.",
      },
      {
        short: "Context",
        title: "Ingestion",
        tooltip: "Upload source documents this workspace uses to inform the draft.",
        subtitle: "Add PDFs, Office files, spreadsheets, or text.",
      },
      {
        short: "Template",
        title: "Formatting",
        tooltip: "Upload Word templates and choose which one merges with the draft.",
        subtitle: "Select the master DOCX that shapes the exported report.",
      },
      {
        short: "Synthesis",
        title: "Synthesis",
        tooltip: "Run the drafting agent from the sidebar session, preview output, export DOCX.",
        subtitle: "Run the specialist pipeline, review artifacts per phase, and download a ZIP package when finished.",
      },
    ],

    /** Use with wizard.stepNav[stepIndex] available at call site (avoids stale closure). */
    stepCaption(stepIndex, total, nav) {
      const s = nav[stepIndex];
      if (!s) return "";
      return `Step ${stepIndex + 1} of ${total}: ${s.title}`;
    },

    step0: {
      title: "System Initialization",
      intro:
        "The Assembly Engine synthesizes provided data sources into compliant, structured output using your templates. Assign how the specialist pipeline runs—manual approval between phases, or automatic hand-offs—with status shown in synthesis until completion or clarification.",
      listItems: [
        "Ingest contextual data layers (PDF, Docs, CSV).",
        "Designate structural output templates.",
        "Command the synthesis sequence.",
        "Export localized data packet.",
      ],
      listPrefixes: ["01.", "02.", "03.", "04."],
      primaryCta: "Initialize Sequence",
    },

    step1: {
      title: "Context Ingestion",
      dropTitle: "Drop Source Materials",
      dropSubtitle: "PDF, DOCX, XLSX, CSV, TXT",
      browseFiles: "Browse Files",
      abort: "Abort",
      nextPhase: "Next Phase",
    },

    step2: {
      title: "Structure Designation",
      dropTitle: "Drop Master Templates",
      dropSubtitle: ".docx, .pdf, or .xlsx (PDF/Excel drive drafting prompts; Word export is still generated as .docx)",
      browseTemplates: "Browse Templates",
      masterTag: "MASTER",
      back: "Back",
      nextPhase: "Next Phase",
      specialistRoutingTitle: "Specialist template routing",
      specialistRoutingHint:
        "Optional: map specialists to a specific template. If unset, specialists use the workspace default template.",
      specialistRoutingUseDefault: "Use workspace default template",
    },

    step3: {
      terminalTitle: "Session Terminal",
      terminalEmpty: "[ TERMINAL AWAITING DIRECTIVES ]",
      sessionRequiredBanner:
        "Select or create an agent session in the left sidebar. Messages apply only to that session.",
      roleAssistant: "SYS.AGENT",
      roleUser: "OPERATOR",
      messagePlaceholder: "Input directive...",
      transmit: "Transmit",
      synthesisTitle: "Session setup",
      sessionSetupIntro:
        "Notes and templates guide how specialists draft. The pipeline card above saves one artifact per completed phase; use the links there or download the full ZIP package when you are ready to hand off files.",
      instructionsPlaceholder: "Global compilation directives...",
      optionalGenerateSummary: "Optional: single-step generate (toolbar specialist)",
      generateLabel: "Generate one draft",
      generateHint:
        "Runs one model pass using the specialist selected in the sidebar toolbar — not the ordered multi-phase pipeline. Use this only when you want a quick standalone draft; normal acquisition drafting uses Run next specialist or Run full automatic chain in the pipeline card.",
      downloadArtifactsPackageLabel: "Download artifacts package (ZIP)",
      downloadArtifactsPackageHint:
        "One ZIP folder: one Markdown file per completed phase, Word exports when the server saved them, and MANIFEST.txt. This is not one integrated Statement of Work file.",
      downloadSessionPackageLabel: "Download session package (ZIP)",
      downloadSessionPackageHint:
        "One download containing separate files per completed phase (Markdown plus Word exports when the server saved them), plus MANIFEST.txt. This is not a single integrated Statement of Work file.",
      downloadCombinedMarkdownLabel: "Download combined Markdown",
      downloadCombinedMarkdownHint:
        "One Markdown file with every phase concatenated — useful for text search only; prefer the ZIP package for proper file boundaries.",
      downloadLabel: "Download Word (latest chat draft)",
      downloadHint:
        "Exports Word from the most recent assistant message in this session — not tied to a specific pipeline phase. The server builds a .docx from drafting output using the workspace default template for styling context; it does not perform Word merge-field or mail-merge mapping.",
      defaultTemplateLabel: "Workspace default template (export pairing)",
      defaultTemplateHint:
        "Active file guides template hints for agents. Prefer .docx for style-preserving placeholder merge when your file uses merge fields.",
      specialistTemplateRoutingLabel: "Specialist-specific template override",
      specialistTemplateRoutingHint:
        "Choose template per specialist, or leave on workspace default. This helps each specialist follow the right structure automatically.",
      templateSelectPlaceholder: "Choose workspace default reference…",
      noTemplatesForExport:
        "No template in this workspace yet. Upload DOCX, PDF, or XLSX from the Template step, choose a default here, or export Markdown only.",
      uploadTemplateQuickBrowse: "Upload template (.docx, .pdf, .xlsx)",
      goToTemplateStep: "Open Template step",
      outputBufferTitle: "Draft preview",
      outputEmpty: "Generate a draft to see formatted preview here.",
      generationWarningsHeading: "Warnings from the last model run",
      generationWarningsHint:
        "If the API is missing LLM keys or the model returned an error, fix configuration and run the phase again. Warnings are also stored in the server response for support.",
      chatRegionLabel: "Session chat drawer",
      openChatDrawerLabel: "Open session chat",
      closeChatDrawerLabel: "Close session chat",
      chatMessageLabel: "Message for the session",

      pipelineDefinitionLoading: "Pipeline definition is loading from the server.",
      pipelineHeading: "Specialist pipeline",
      pipelineOrchestrationLabel: "Hand-off mode",
      pipelineModeManual: "Manual review",
      pipelineModeManualHint: "After each specialist, execution pauses until you approve the next step.",
      pipelineModeAuto: "Automatic chain",
      pipelineModeAutoHint: "The server advances through specialists until the run finishes or clarification is needed.",
      pipelineInstructionsNote: "Optional notes for the next specialist run (applied to the first phase when advancing).",
      pipelineFixedOrderNote:
        "Specialist pipeline runs in a fixed order regardless of the toolbar: Requirements Discovery, Requirements Analyst, Market Research, SOW writer, then IGCE Cost Estimator.",
      pipelineRunNext: "Run next specialist",
      pipelineRunChain: "Run full automatic chain",
      pipelineApproveHint: "After a specialist finishes in manual mode, approving the continuation is bundled into Run next specialist.",
      pipelineBlockedManual: "At a manual checkpoint—approve below or switch to automatic mode to continue without per-step approval.",
      pipelineClarificationHint:
        "The model asked for clarification. Reply in the session chat (Open session chat), confirm with the checkbox below if shown, then continue the pipeline.",
      pipelineClarificationResolvedLabel: "I have addressed the clarification in the session chat",
      pipelineResetLabel: "Reset pipeline progress",
      pipelineResetConfirm: "Reset pipeline step and checkpoints for this session? Chat history is unchanged.",
      pipelineStatusPaused: "Paused — manual review checkpoint",
      pipelineStatusNeedsClarification: "Paused — clarification needed",
      pipelineStatusDone: "Pipeline finished",
      pipelineStatusPhase: (current, total) => `Progress: specialists completed ${Math.min(current, total)} of ${total}`,
      pipelineLastPhaseRun: (name) => (name ? `Last phase completed: ${name}` : ""),
      artifactPill: (n) => `${n} pipeline artifact${n === 1 ? "" : "s"}`,
      artifactPillTitle: "Structured outputs produced by completed specialist pipeline phases in this session.",
      progressPill: (completed, total) => `Progress: ${completed} of ${total} phases`,
      progressPillTitle: "Pipeline phases finished so far (each finished phase produced one stored artifact).",
      artifactsReadyPill: (n) => `${n} artifact${n === 1 ? "" : "s"} ready for download`,
      artifactsReadyPillTitle: "Markdown artifacts stored on the server for this session; download individually or as a bundle.",
      pipelinePhaseArtifactReady: "Artifact saved on the server.",
      pipelinePhaseArtifactPending:
        "This phase is complete; artifact links appear here when the list loads. If nothing shows, wait a moment or open Storage view and return.",
      pipelinePhaseArtifactLinkGroupLabel: (phaseName) => `Downloads for ${phaseName}`,
      artifactLinkMarkdown: "Markdown file",
      artifactLinkWord: "Word export",
      artifactWordExportNotePrefix: "Word export note:",
      pipelineCardMoreExportsHint:
        "For a single combined Markdown file or Word from the latest chat message, use Storage: Produced pipeline artifacts in the manager view.",
      pipelinePhaseHandoff: (nextAgentName) => `Handing off to ${nextAgentName}.`,
      pipelinePhaseStatusComplete: "Complete",
      pipelinePhaseRunning: "Running…",
      pipelinePhaseRunningDetail: "Producing this phase’s artifact.",
      pipelinePhaseWaiting: "Waiting",
      pipelinePhaseWaitingDetail: "This phase starts after earlier phases finish.",
      pipelinePhaseNextUp: "Next up",
      pipelinePhaseNextUpDetail: (agentName) => `Starts when you run the next specialist${agentName ? ` (${agentName})` : ""}.`,
      pipelinePhaseAwaitingApproval: "Awaiting your approval",
      pipelinePhaseAwaitingApprovalDetail: "Review the chat and prior output, then choose Run next specialist.",
      pipelinePhaseNeedsClarification: "Needs clarification",
      pipelinePhaseNeedsClarificationDetail: "Reply in session chat, confirm below if prompted, then continue the pipeline.",
    },
  },

  observability: {
    pageTitle: "Operations overview",
    pageIntro:
      "Quick links and status for the specialist pipeline, workspace storage, LangSmith tracing, and recent server-side events (including Word exports and downloads).",
    eventsTitle: "Recent events",
    eventsIntro:
      "Pipeline completions, Word export results, and HTTP errors (4xx/5xx) recorded by this API process. Data is in-memory and resets when the server restarts; use LangSmith for full LLM traces.",
    eventsRefresh: "Refresh now",
    eventsEmpty: "No events recorded yet. Run a pipeline step or trigger an API error to populate this list.",
    eventsLoadError: "Could not load observability data from the server.",
    eventsColumnTime: "Time (UTC)",
    eventsColumnLevel: "Level",
    eventsColumnCategory: "Category",
    eventsColumnMessage: "Message",
    tableCaption: "Pipeline, storage, and observability",
    colArea: "Area",
    colStatus: "Status",
    colAction: "Details",
    rowPipelineName: "Pipeline",
    rowPipelineStatus: "Run specialists from the Synthesis step (Pipeline view).",
    rowPipelineAction: "Switch to Pipeline using the control above.",
    rowStorageName: "Storage",
    rowStorageStatus: (nCtx, nTpl) => `${nCtx} context file(s), ${nTpl} template(s) in this workspace.`,
    rowStorageAction: "Switch to Storage to upload or remove files.",
    rowObsName: "Observability (LangSmith)",
    rowObsOn: "Tracing is enabled. LLM runs are tagged federal-sow-pipeline or federal-sow-generate with the specialist id.",
    rowObsOff: "Tracing is off. Set LANGCHAIN_TRACING_V2=true and LANGCHAIN_API_KEY in the backend .env to record runs.",
    rowObsProject: (name) => (name ? `Project name: ${name}` : ""),
    openLangSmith: "Open LangSmith",
    requirementsRolesNote:
      "There is one discovery agent (requirements_agent) and one formal analyst (requirements_analyst); they are different pipeline phases, not duplicates.",
  },

  manager: {
    contextTitle: "Storage: Context",
    templatesTitle: "Storage: Templates",
    pipelineArtifactsTitle: "Storage: Produced pipeline artifacts",
    pipelineArtifactsIntro:
      "Each specialist phase saves a Markdown artifact for the session selected in the sidebar. The server also attempts a Word (.docx) export per phase. The active template feeds outline hints to the model; per-phase exports are Word files built from drafting output — not guaranteed pixel-perfect insertion into the agency template binary. PDF is not generated automatically.",
    pipelineArtifactsNoSession: "Select a session in the sidebar to list produced artifacts.",
    pipelineArtifactsEmpty:
      "No pipeline artifacts yet for this session. Run specialists from the Synthesis step (Pipeline view). If the list stays empty after a run, check the browser notice bar for API errors.",
    pipelineArtifactsDownloadOne: "Markdown",
    pipelineArtifactsDownloadMerged: "Word (export)",
    pipelineArtifactsDownloadPackage: "Download artifacts package (ZIP)",
    pipelineArtifactsDownloadCombinedMarkdown: "Download combined Markdown",
    pipelineArtifactsSessionLabel: "Session",
    dropSourceMaterials: "Drop Source Materials",
    browse: "Browse",
    dropDocxTemplates: "Drop templates (DOCX, PDF, or XLSX)",
  },

  emptyState: {
    title: "SYSTEM STANDBY",
    subtitle: "Initialize a workspace to engage parameters.",
  },
};
