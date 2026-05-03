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
  },

  notices: {
    uploadedContextFiles: (count) => `Uploaded ${count} context file(s).`,
    uploadedTemplateFiles: (count) => `Uploaded ${count} template file(s).`,
    activeTemplateUpdated: "Active template updated.",
    draftGenerationSuccessful: "Draft Generation Successful.",
    exportReady: "Export ready.",
    markdownExportReady: "Markdown file ready to download.",
    artifactsExportReady: "All pipeline artifacts bundled in one Markdown download.",
  },

  sidebar: {
    title: "Workspaces",
    sessionsSubtitle: "Agent sessions for this workspace",
    newWorkspaceTitle: "Initialize Workspace",
    newSessionTitle: "New Session",
    noSessions: "No sessions yet.",
    createSessionCta: "Create session",
    handOffNote:
      "New sessions reuse the specialist on the selected session when you click plus. The dropdown specialist controls single-step Generate only. The specialist pipeline chooses its own sequence on the synthesis step, so you can leave the toolbar specialist unchanged when you rely on the pipeline.",
  },

  toolbar: {
    statContext: "CONTEXT",
    statTemplates: "TEMPLATES",
    statSessions: "SESSIONS",
    pipeline: "Pipeline",
    storage: "Storage",
    specialistBadge: "Session specialist",
    specialistUnset: "(select a session)",
    specialistSelectTitle: "Change specialist for drafts and standalone Generate draft",
  },

  agents: {
    draftingStatus: (specialistLabel) =>
      `${specialistLabel} is drafting. This is a single model run for this session.`,
    pipelineRunning: "Pipeline specialists are drafting (server-side orchestration).",
    exportingStatus: "Merging draft into Word template.",
    markdownExportStatus: "Generating Markdown export.",
    artifactsExportStatus: "Bundling all pipeline phase drafts into one Markdown file.",
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
        subtitle: "Co-create in the terminal, generate a draft, then merge to Word.",
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
      synthesisTitle: "Synthesis Controls",
      instructionsPlaceholder: "Global compilation directives...",
      generateLabel: "Generate draft",
      generateHint:
        "One toolbar Generate pass uses only the specialist selected above. The ordered specialist pipeline ignores that selection and runs its own phases; use Download all artifacts to save every phase in one Markdown file.",
      downloadAllArtifactsLabel: "Download all artifacts",
      downloadAllArtifactsHint:
        "One Markdown file listing each completed pipeline phase (and the same content you see in chat), separated by horizontal rules. For a final Word package merged from the latest draft, use Download Word below.",
      downloadLabel: "Download Word (final draft)",
      downloadHint:
        "Merges the most recent assistant draft into the workspace template. Use this for the finished package after the pipeline; it does not archive each earlier phase separately. Uses the workspace default template when set. Pure .docx templates can merge with Jinja placeholders; PDF or Excel references produce structured Word built from drafting output.",
      defaultTemplateLabel: "Workspace default template (export pairing)",
      defaultTemplateHint:
        "Active file guides template hints for agents. Prefer .docx for style-preserving placeholder merge when your file uses merge fields.",
      templateSelectPlaceholder: "Choose workspace default reference…",
      noTemplatesForExport:
        "No template in this workspace yet. Upload DOCX, PDF, or XLSX from the Template step, choose a default here, or export Markdown only.",
      uploadTemplateQuickBrowse: "Upload template (.docx, .pdf, .xlsx)",
      goToTemplateStep: "Open Template step",
      outputBufferTitle: "Draft preview",
      outputEmpty: "Generate a draft to see formatted preview here.",
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
    },
  },

  manager: {
    contextTitle: "Storage: Context",
    templatesTitle: "Storage: Templates",
    dropSourceMaterials: "Drop Source Materials",
    browse: "Browse",
    dropDocxTemplates: "Drop templates (DOCX, PDF, or XLSX)",
  },

  emptyState: {
    title: "SYSTEM STANDBY",
    subtitle: "Initialize a workspace to engage parameters.",
  },
};
