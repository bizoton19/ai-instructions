/**
 * Central UI copy for the Federal SOW Agent frontend.
 * Edit this file to change titles, labels, and instructional text without touching components.
 */

export const content = {
  toastPrefix: "//",

  header: {
    appTitle: "SOW // Assembly Engine",
    userBadge: "System Active",
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
  },

  sidebar: {
    title: "Workspaces",
    sessionsSubtitle: "Agent sessions for this workspace",
    newWorkspaceTitle: "Initialize Workspace",
    newSessionTitle: "New Session",
    noSessions: "No sessions yet.",
    createSessionCta: "Create session",
    specialistForNextSessionLabel: "Specialist role for new sessions",
    changeSpecialistAria: "Change specialist for this session",
    handOffNote:
      "Each session tracks one pipeline run. Manual review pauses between specialists until you approve. Automatic mode runs the specialist chain on the server and updates progress here until completion or clarification.",
  },

  toolbar: {
    statContext: "CONTEXT",
    statTemplates: "TEMPLATES",
    statSessions: "SESSIONS",
    pipeline: "Pipeline",
    storage: "Storage",
    specialistBadge: "Active specialist",
    specialistUnset: "(select a session)",
  },

  agents: {
    draftingStatus: (specialistLabel) =>
      `${specialistLabel} is drafting. This is a single model run for this session.`,
    pipelineRunning: "Pipeline specialists are drafting (server-side orchestration).",
    exportingStatus: "Merging draft into Word template.",
    markdownExportStatus: "Generating Markdown export.",
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
      dropSubtitle: "DOCX Format Required",
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
        "Runs the drafting agent on this session using workspace context and the instructions below. Preview updates when complete.",
      downloadLabel: "Download Word (DOCX)",
      downloadHint:
        "Requires a workspace default template below. For template-free output, use Download Markdown.",
      downloadMarkdownLabel: "Download Markdown",
      downloadMarkdownHint: "Structured sections or latest assistant output as a .md file (no Word template required).",
      defaultTemplateLabel: "Workspace default template (Word export)",
      defaultTemplateHint: "Pick which uploaded .docx is active for this workspace. Upload more in the Template wizard step or below.",
      templateSelectPlaceholder: "Choose workspace default…",
      noTemplatesForExport: "No Word template in this workspace yet. Upload a .docx to enable Word export, or export Markdown instead.",
      uploadTemplateQuickBrowse: "Upload .docx template",
      goToTemplateStep: "Open Template step",
      outputBufferTitle: "Draft preview",
      outputEmpty: "Generate a draft to see formatted preview here.",

      pipelineDefinitionLoading: "Pipeline definition is loading from the server.",
      pipelineHeading: "Specialist pipeline",
      pipelineOrchestrationLabel: "Hand-off mode",
      pipelineModeManual: "Manual review",
      pipelineModeManualHint: "After each specialist, execution pauses until you approve the next step.",
      pipelineModeAuto: "Automatic chain",
      pipelineModeAutoHint: "The server advances through specialists until the run finishes or clarification is needed.",
      pipelineInstructionsNote: "Optional notes for the next specialist run (applied to the first phase when advancing).",
      pipelineRunNext: "Run next specialist",
      pipelineRunChain: "Run full automatic chain",
      pipelineApproveHint: "After a specialist finishes in manual mode, approving the continuation is bundled into Run next specialist.",
      pipelineBlockedManual: "At a manual checkpoint—approve below or switch to automatic mode to continue without per-step approval.",
      pipelineClarificationHint:
        "The model asked for clarification. Reply in the terminal, enable the checkbox below, then continue the pipeline.",
      pipelineClarificationResolvedLabel: "I have addressed the clarification in the terminal above",
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
    dropDocxTemplates: "Drop DOCX Templates",
  },

  emptyState: {
    title: "SYSTEM STANDBY",
    subtitle: "Initialize a workspace to engage parameters.",
  },
};
