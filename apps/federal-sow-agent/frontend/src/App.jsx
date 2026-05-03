import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  Box,
  Calculator,
  ChevronRight,
  ClipboardList,
  Database,
  FileDown,
  FilePenLine,
  FileText,
  FileUp,
  FolderOpen,
  LayoutTemplate,
  LineChart,
  Plus,
  Search,
  Settings,
  Terminal,
  Trash2,
  User,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { api, ApiError, downloadFileByPath } from "./api";
import { content } from "./content";

/** When the API leaves full_markdown empty but fills structured fields (e.g. IGCE lines in deliverables). */
function sectionsToPreviewMarkdown(sections) {
  if (!sections || typeof sections !== "object") return "";
  const fm = String(sections.full_markdown || "").trim();
  if (fm) return fm;
  const order = [
    ["Purpose", "purpose"],
    ["Background", "background"],
    ["Scope", "scope"],
    ["Deliverables", "deliverables"],
    ["Period of Performance", "period_of_performance"],
    ["Roles and Responsibilities", "roles_and_responsibilities"],
    ["Acceptance Criteria", "acceptance_criteria"],
    ["Assumptions and Constraints", "assumptions_and_constraints"],
  ];
  const parts = [];
  for (const [title, key] of order) {
    const block = String(sections[key] || "").trim();
    if (block) parts.push(`## ${title}\n\n${block}`);
  }
  return parts.join("\n\n");
}

/** Stable icon and color per specialist for pipeline timeline (accessibility: not emoji). */
const SPECIALIST_AVATAR = {
  requirements_agent: { Icon: Search, bg: "#1b6ec2" },
  requirements_analyst: { Icon: ClipboardList, bg: "#168821" },
  market_research: { Icon: LineChart, bg: "#9c3d9a" },
  sow_writer: { Icon: FilePenLine, bg: "#c05600" },
  cost_estimator: { Icon: Calculator, bg: "#4a4a4a" },
};

function SpecialistAvatar({ agentId, emphasize }) {
  const spec = SPECIALIST_AVATAR[agentId] || { Icon: User, bg: "#565c65" };
  const Icon = spec.Icon;
  return (
    <span
      className={`specialist-avatar${emphasize ? " specialist-avatar--emphasize" : ""}`}
      style={{ backgroundColor: spec.bg }}
      aria-hidden="true"
    >
      <Icon size={14} strokeWidth={2} color="#fff" />
    </span>
  );
}

function emailInitials(email) {
  if (!email) return "?";
  const local = email.split("@")[0] || email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

/** Per-row pipeline timeline labels (VS-style step status). */
function pipelinePhaseRowModel({
  phaseIndex,
  pipelinePlan,
  activeSession,
  loading,
  clarActive,
  manualPause,
  pipelineDone,
  p3,
}) {
  const total = pipelinePlan.length;
  const step = activeSession?.pipeline_step ?? 0;
  const isCompleted = pipelineDone || phaseIndex < step;
  const isCurrent = !pipelineDone && phaseIndex === step;

  let statusClass = "waiting";
  if (isCompleted) statusClass = "completed";
  else if (isCurrent) statusClass = "running";

  const showPulse = Boolean(isCurrent && !clarActive && !manualPause && loading);

  let primary = "";
  /** @type {string[]} */
  let detail = [];

  if (isCompleted) {
    primary = p3.pipelinePhaseStatusComplete;
    detail = [p3.pipelinePhaseArtifactReady];
    if (!pipelineDone && phaseIndex < total - 1 && step > phaseIndex) {
      const nextName = pipelinePlan[phaseIndex + 1]?.name;
      if (nextName) detail.push(p3.pipelinePhaseHandoff(nextName));
    }
  } else if (isCurrent) {
    if (clarActive) {
      primary = p3.pipelinePhaseNeedsClarification;
      detail = [p3.pipelinePhaseNeedsClarificationDetail];
    } else if (manualPause) {
      primary = p3.pipelinePhaseAwaitingApproval;
      detail = [p3.pipelinePhaseAwaitingApprovalDetail];
    } else if (loading) {
      primary = p3.pipelinePhaseRunning;
      detail = [p3.pipelinePhaseRunningDetail];
    } else {
      primary = p3.pipelinePhaseNextUp;
      detail = [p3.pipelinePhaseNextUpDetail(pipelinePlan[phaseIndex]?.name || "")];
    }
  } else {
    primary = p3.pipelinePhaseWaiting;
    detail = [p3.pipelinePhaseWaitingDetail];
  }

  return { statusClass, showPulse, primary, detail };
}

function App() {
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contextDocs, setContextDocs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [generation, setGeneration] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyHint, setBusyHint] = useState(null);
  const [agentsCatalog, setAgentsCatalog] = useState([]);
  const [pipelinePlan, setPipelinePlan] = useState([]);
  const [clarificationResolved, setClarificationResolved] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [viewMode, setViewMode] = useState("wizard"); // wizard | manager | observability
  const [observabilityStatus, setObservabilityStatus] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTemp, setSettingsTemp] = useState(0.2);
  const [settingsGuidance, setSettingsGuidance] = useState("");
  const [pipelineArtifacts, setPipelineArtifacts] = useState([]);

  const agentOptions = agentsCatalog.length
    ? agentsCatalog
    : [{ id: "sow_writer", name: "SOW/PWS Writer", description: "" }];

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId) || null,
    [workspaces, workspaceId],
  );
  const activeTemplateId = activeWorkspace?.active_template_asset_id || null;
  const specialistTemplateMap = activeWorkspace?.specialist_template_map || {};
  const stepNav = content.wizard.stepNav;

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  const pipelineUi = useMemo(() => {
    const p3 = content.wizard.step3;
    const totalPhases = pipelinePlan.length;
    if (!activeSession || totalPhases === 0) {
      return {
        totalPhases,
        pipelineDone: false,
        clarActive: false,
        manualPause: false,
        nextName: null,
        statusLabel: "",
        progressLine: "",
        orch: "manual_review",
      };
    }
    const step = activeSession.pipeline_step ?? 0;
    const pipelineDone = !!(activeSession.pipeline_completed || step >= totalPhases);
    const clarActive = !!activeSession.needs_user_clarification;
    const orch = activeSession.orchestration_mode || "manual_review";
    const manualPause = orch === "manual_review" && activeSession.pipeline_paused && !clarActive;

    let statusLabel = "";
    if (pipelineDone) statusLabel = p3.pipelineStatusDone;
    else if (clarActive) statusLabel = p3.pipelineStatusNeedsClarification;
    else if (manualPause) statusLabel = p3.pipelineStatusPaused;

    const progressLine = p3.pipelineStatusPhase(step, totalPhases);
    const nextName = !pipelineDone && pipelinePlan[step] ? pipelinePlan[step].name : null;

    return {
      totalPhases,
      pipelineDone,
      clarActive,
      manualPause,
      nextName,
      statusLabel,
      progressLine,
      orch,
    };
  }, [activeSession, pipelinePlan]);

  const pipelineProgressCounts = useMemo(() => {
    const total = pipelinePlan.length;
    if (!activeSession || total === 0) return { completed: 0, total: 0 };
    const step = activeSession.pipeline_step ?? 0;
    const allDone = !!(activeSession.pipeline_completed || step >= total);
    const completed = allDone ? total : Math.min(step, total);
    return { completed, total };
  }, [activeSession, pipelinePlan]);

  const hasDraftContent = useMemo(() => {
    if ((activeSession?.pipeline_artifact_count ?? 0) > 0) return true;
    const s = generation?.sections;
    if ((s?.full_markdown || "").trim()) return true;
    if (s) {
      const keys = [
        "purpose",
        "background",
        "scope",
        "deliverables",
        "period_of_performance",
        "roles_and_responsibilities",
        "acceptance_criteria",
        "assumptions_and_constraints",
      ];
      if (keys.some((k) => (s[k] || "").trim())) return true;
    }
    return messages.some((m) => m.role === "assistant" && (m.content || "").trim());
  }, [generation, messages, activeSession?.pipeline_artifact_count]);

  const previewMarkdown = useMemo(() => sectionsToPreviewMarkdown(generation?.sections), [generation]);

  function specialistDisplayName(agentTypeId) {
    if (!agentTypeId) return "";
    const name = agentsCatalog.find((a) => a.id === agentTypeId)?.name;
    return name || agentTypeId;
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listWorkspaces();
        setWorkspaces(data);
        setWorkspaceId((curr) => {
          if (!curr && data.length > 0) return data[0].id;
          return curr;
        });
      } catch {
        /* ignore bootstrap list failure */
      }
    })();
  }, []);

  useEffect(() => {
    api
      .listAgents()
      .then(setAgentsCatalog)
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.listPipeline().then(setPipelinePlan).catch(() => {});
  }, []);

  useEffect(() => {
    if (viewMode !== "observability") return;
    api
      .getObservability()
      .then(setObservabilityStatus)
      .catch(() => setObservabilityStatus({ langsmith_tracing_enabled: false, error: true }));
  }, [viewMode]);

  useEffect(() => {
    if (!workspaceId || !templates.length || activeTemplateId) return;
    if (templates.length !== 1) return;
    api
      .activateTemplate(workspaceId, templates[0].id)
      .then(() => refreshWorkspaceData(workspaceId))
      .catch(() => {});
  }, [workspaceId, templates, activeTemplateId]);

  useEffect(() => {
    if (settingsOpen && activeWorkspace) {
      setSettingsTemp(Number(activeWorkspace.agent_temperature ?? 0.2));
      setSettingsGuidance(String(activeWorkspace.agent_workspace_instructions ?? ""));
    }
  }, [settingsOpen, activeWorkspace]);

  useEffect(() => {
    setSessionId(null);
    setMessages([]);
    setGeneration(null);
  }, [workspaceId]);

  useEffect(() => {
    setClarificationResolved(false);
  }, [sessionId]);

  async function loadWorkspaces() {
    const data = await api.listWorkspaces();
    setWorkspaces(data);
    if (!workspaceId && data.length > 0) {
      setWorkspaceId(data[0].id);
    }
  }

  async function refreshWorkspaceData(targetWorkspaceId = workspaceId) {
    if (!targetWorkspaceId) return;
    const [s, c, t] = await Promise.all([
      api.listSessions(targetWorkspaceId),
      api.listContext(targetWorkspaceId),
      api.listTemplates(targetWorkspaceId),
    ]);
    setSessions(s);
    setContextDocs(c);
    setTemplates(t);
    await loadWorkspaces();
    setSessionId((curr) => {
      if (s.length === 0) return null;
      if (curr != null && s.some((x) => x.id === curr)) return curr;
      return s[0].id;
    });
  }

  useEffect(() => {
    if (!workspaceId) return;
    refreshWorkspaceData(workspaceId).catch((e) => showNotice(e.message));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !sessionId) {
      setMessages([]);
      return;
    }
    api
      .listMessages(workspaceId, sessionId)
      .then(setMessages)
      .catch((e) => showNotice(e.message));
  }, [workspaceId, sessionId]);

  useEffect(() => {
    if (!workspaceId || !sessionId) {
      setPipelineArtifacts([]);
      return;
    }
    api
      .listPipelineArtifacts(workspaceId, sessionId)
      .then(setPipelineArtifacts)
      .catch((e) => {
        setPipelineArtifacts([]);
        showNotice(e instanceof ApiError ? `Could not load pipeline artifacts: ${e.message}` : "Could not load pipeline artifacts.");
      });
  }, [workspaceId, sessionId]);

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 6000);
  }

  async function onSaveWorkspaceAgentSettings(e) {
    e.preventDefault();
    if (!workspaceId || !activeWorkspace) return;
    try {
      await api.patchWorkspaceAgentSettings(workspaceId, {
        agent_temperature: settingsTemp,
        agent_workspace_instructions: settingsGuidance.trim() === "" ? null : settingsGuidance.trim(),
      });
      await loadWorkspaces();
      setSettingsOpen(false);
      showNotice("Workspace agent settings saved.");
    } catch (err) {
      showNotice(err instanceof ApiError ? err.message : String(err));
    }
  }

  async function onCreateWorkspace() {
    const name = prompt(content.prompts.workspaceName) || content.prompts.defaultWorkspaceName;
    if (!name) return;
    try {
      const ws = await api.createWorkspace(name);
      await loadWorkspaces();
      setWorkspaceId(ws.id);
    } catch (e) {
      showNotice(e.message);
    }
  }

  async function onCreateSession() {
    if (!workspaceId) return;
    const agentType = activeSession?.agent_type ?? "sow_writer";
    try {
      const s = await api.createSession(workspaceId, content.prompts.newSessionTitle, agentType);
      const next = await api.listSessions(workspaceId);
      setSessions(next);
      setSessionId(s.id);
    } catch (e) {
      showNotice(e.message);
    }
  }

  async function onUpdateSessionAgent(sid, nextAgentType) {
    if (!workspaceId || !sid) return;
    try {
      await api.updateSession(workspaceId, sid, { agent_type: nextAgentType });
      const next = await api.listSessions(workspaceId);
      setSessions(next);
    } catch (e) {
      showNotice(e.message);
    }
  }

  async function uploadManyContext(files) {
    if (!files?.length || !workspaceId) return;
    setBusyHint(content.agents.ingestStatus);
    setLoading(true);
    try {
      for (const file of files) {
        await api.uploadContext(workspaceId, file);
      }
      await refreshWorkspaceData(workspaceId);
      showNotice(content.notices.uploadedContextFiles(files.length));
    } catch (err) {
      showNotice(err.message);
    } finally {
      setBusyHint(null);
      setLoading(false);
    }
  }

  async function uploadManyTemplates(files) {
    if (!files?.length || !workspaceId) return;
    setBusyHint(content.agents.ingestStatus);
    setLoading(true);
    try {
      for (const file of files) {
        await api.uploadTemplate(workspaceId, file);
      }
      await refreshWorkspaceData(workspaceId);
      showNotice(content.notices.uploadedTemplateFiles(files.length));
    } catch (err) {
      showNotice(err.message);
    } finally {
      setBusyHint(null);
      setLoading(false);
    }
  }

  async function onUploadContext(e) {
    const files = Array.from(e.target.files || []);
    await uploadManyContext(files);
    e.target.value = "";
  }

  async function onUploadTemplate(e) {
    const files = Array.from(e.target.files || []);
    await uploadManyTemplates(files);
    e.target.value = "";
  }

  async function onDeleteContext(assetId) {
    if (!workspaceId) return;
    await api.deleteContext(workspaceId, assetId);
    await refreshWorkspaceData(workspaceId);
  }

  async function onDeleteTemplate(assetId) {
    if (!workspaceId) return;
    await api.deleteTemplate(workspaceId, assetId);
    await refreshWorkspaceData(workspaceId);
  }

  async function onActivateTemplate(assetId) {
    if (!workspaceId) return;
    await api.activateTemplate(workspaceId, assetId);
    await loadWorkspaces();
    showNotice(content.notices.activeTemplateUpdated);
  }

  async function onAssignSpecialistTemplate(agentId, templateAssetId) {
    if (!workspaceId || !activeWorkspace || !agentId) return;
    const nextMap = { ...(activeWorkspace.specialist_template_map || {}) };
    if (templateAssetId) nextMap[agentId] = templateAssetId;
    else delete nextMap[agentId];
    try {
      await api.patchWorkspaceAgentSettings(workspaceId, {
        specialist_template_map: nextMap,
      });
      await loadWorkspaces();
      showNotice("Specialist template routing updated.");
    } catch (err) {
      showNotice(err instanceof ApiError ? err.message : String(err));
    }
  }

  async function onSendMessage(e) {
    e.preventDefault();
    if (!messageText.trim() || !workspaceId || !sessionId) return;
    await api.addMessage(workspaceId, sessionId, messageText);
    setMessageText("");
    setMessages(await api.listMessages(workspaceId, sessionId));
  }

  async function onGenerate() {
    if (!workspaceId || !sessionId) return;
    setBusyHint(
      content.agents.draftingStatus(
        specialistDisplayName(activeSession?.agent_type) || content.toolbar.specialistUnset,
      ),
    );
    setLoading(true);
    try {
      const result = await api.generate(workspaceId, sessionId, instructions);
      setGeneration(result);
      setMessages(await api.listMessages(workspaceId, sessionId));
      showNotice(content.notices.draftGenerationSuccessful);
    } catch (err) {
      showNotice(err.message);
    } finally {
      setBusyHint(null);
      setLoading(false);
    }
  }

  async function onOrchestrationModeChange(mode) {
    if (!workspaceId || !sessionId) return;
    try {
      await api.updateSession(workspaceId, sessionId, { orchestration_mode: mode });
      const nextSessions = await api.listSessions(workspaceId);
      setSessions(nextSessions);
      showNotice(
        mode === "automatic"
          ? "Orchestration: automatic specialist chain enabled."
          : "Orchestration: manual review between specialists enabled.",
      );
    } catch (err) {
      showNotice(err instanceof ApiError ? err.message : String(err.message));
    }
  }

  async function onPipelineAdvance(execution) {
    if (!workspaceId || !sessionId || !activeSession) return;
    const orch = activeSession.orchestration_mode || "manual_review";
    const approveManualGate =
      orch === "manual_review" &&
      activeSession.pipeline_paused &&
      !activeSession.needs_user_clarification;

    setBusyHint(execution === "auto_chain" ? content.agents.pipelineRunning : content.agents.draftingStatus(specialistDisplayName(activeSession.agent_type) || content.toolbar.specialistUnset));
    setLoading(true);
    try {
      const result = await api.pipelineAdvance(workspaceId, sessionId, {
        additional_instructions: instructions.trim() || null,
        approve_manual_gate: approveManualGate,
        clarification_resolved: activeSession.needs_user_clarification ? clarificationResolved : false,
        execution,
      });
      setGeneration({
        sections: result.sections || null,
        warnings: result.warnings || [],
      });
      setClarificationResolved(false);
      setMessages(await api.listMessages(workspaceId, sessionId));
      await refreshWorkspaceData(workspaceId);
      try {
        const arts = await api.listPipelineArtifacts(workspaceId, sessionId);
        setPipelineArtifacts(arts);
      } catch {
        setPipelineArtifacts([]);
      }
      showNotice(
        execution === "auto_chain" && result.phases_run && result.phases_run > 1
          ? `Pipeline ran ${result.phases_run} specialist phases. Preview updated.`
          : "Pipeline step completed. Preview updated.",
      );
    } catch (err) {
      await refreshWorkspaceData(workspaceId);
      if (err instanceof ApiError) {
        if (err.status === 428 && err.detailPayload) {
          showNotice(typeof err.detailPayload.message === "string" ? err.detailPayload.message : err.message);
        } else {
          showNotice(err.message);
        }
      } else {
        showNotice(err.message);
      }
    } finally {
      setBusyHint(null);
      setLoading(false);
    }
  }

  async function onPipelineResetClick() {
    if (!workspaceId || !sessionId) return;
    const p3 = content.wizard.step3;
    if (!window.confirm(p3.pipelineResetConfirm)) return;
    setBusyHint(p3.pipelineResetLabel);
    setLoading(true);
    try {
      const result = await api.pipelineReset(workspaceId, sessionId);
      setGeneration({
        sections: result.sections ?? null,
        warnings: result.warnings || [],
      });
      setClarificationResolved(false);
      await refreshWorkspaceData(workspaceId);
      setMessages(await api.listMessages(workspaceId, sessionId));
      setPipelineArtifacts([]);
      showNotice("Pipeline progress reset.");
    } catch (err) {
      showNotice(err.message);
    } finally {
      setBusyHint(null);
      setLoading(false);
    }
  }

  async function onMergeDownload() {
    if (!workspaceId || !sessionId || !activeTemplateId) return;
    setBusyHint(content.agents.exportingStatus);
    setLoading(true);
    try {
      const merged = await api.exportDocument(workspaceId, sessionId, {
        template_asset_id: activeTemplateId,
        use_latest_generation: true,
      });
      await downloadFileByPath(merged.download_path);
      showNotice(content.notices.exportReady);
    } catch (err) {
      showNotice(err.message);
    } finally {
      setBusyHint(null);
      setLoading(false);
    }
  }

  async function onDownloadAllArtifacts() {
    if (!workspaceId || !sessionId) return;
    setBusyHint(content.agents.artifactsExportStatus);
    setLoading(true);
    try {
      await downloadFileByPath(api.downloadAllPipelineArtifactsPath(workspaceId, sessionId));
      showNotice(content.notices.artifactsExportReady);
    } catch (err) {
      showNotice(err.message);
    } finally {
      setBusyHint(null);
      setLoading(false);
    }
  }

  // Animation Variants
  const fadeUp = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  return (
    <div className="app-container">
      {/* Toast Notice */}
      <AnimatePresence>
        {notice && (
          <motion.div 
            className="toast-container"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
          >
            <div className="toast">
              <span style={{ color: "var(--text-accent)", marginRight: "8px" }}>{content.toastPrefix}</span>
              {notice}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="top-nav">
        <div className="logo-section">
          <div className="logo-mark" aria-hidden />
          <h1 className="app-title">{content.header.appTitle}</h1>
        </div>
        <div className="top-nav-actions">
          {activeWorkspace ? (
            <button
              type="button"
              className="btn-icon btn-icon-settings"
              onClick={() => setSettingsOpen(true)}
              title={content.header.settingsButtonTitle}
              aria-label={content.header.settingsButtonTitle}
            >
              <Settings size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
          <div className="top-nav-user" title={content.auth.displayEmail}>
            <span className="user-avatar" aria-label={content.auth.initialsHint}>
              {emailInitials(content.auth.displayEmail)}
            </span>
            <span className="user-email-text">{content.auth.displayName}</span>
          </div>
          <span className="top-nav-hint">{content.auth.placeholderNote}</span>
        </div>
      </header>

      {busyHint ? (
        <div className="busy-strip" role="status" aria-live="polite">
          <Activity size={16} aria-hidden="true" style={{ opacity: loading ? 1 : 0.5 }} />
          <span className="busy-strip-text">{busyHint}</span>
        </div>
      ) : null}

      <main className="main-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div>
              <h2 className="sidebar-title">{content.sidebar.title}</h2>
              {workspaceId ? (
                <p className="sidebar-subtitle">{content.sidebar.sessionsSubtitle}</p>
              ) : null}
            </div>
            <button className="btn-icon" onClick={onCreateWorkspace} title={content.sidebar.newWorkspaceTitle}>
              <Plus size={16} />
            </button>
          </div>
          
          <div className="sidebar-scroll">
            {workspaces.map((ws) => (
              <div key={ws.id}>
                <button 
                  className={`ws-item ${workspaceId === ws.id ? "active" : ""}`}
                  onClick={() => setWorkspaceId(ws.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <FolderOpen size={16} color={workspaceId === ws.id ? "var(--text-accent)" : "currentColor"} />
                    <span>{ws.name}</span>
                  </div>
                  {workspaceId === ws.id && (
                    <div 
                      onClick={(e) => { e.stopPropagation(); onCreateSession(); }}
                      style={{ cursor: "pointer" }}
                      title={content.sidebar.newSessionTitle}
                    >
                      <Plus size={14} color="var(--text-main)" />
                    </div>
                  )}
                </button>
                
                <AnimatePresence>
                  {workspaceId === ws.id && (
                    <motion.div 
                      className="sessions-container"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      {sessions.length === 0 ? (
                        <div className="sessions-empty">
                          <p className="sessions-empty-text">{content.sidebar.noSessions}</p>
                          <button
                            type="button"
                            className="btn sessions-empty-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateSession();
                            }}
                          >
                            <Plus size={14} />
                            {content.sidebar.createSessionCta}
                          </button>
                        </div>
                      ) : (
                        sessions.map((s) => (
                          <div
                            key={s.id}
                            className={`session-row ${sessionId === s.id ? "session-row-selected" : ""}`}
                          >
                            <button
                              type="button"
                              className={`session-item ${sessionId === s.id ? "active" : ""}`}
                              onClick={() => setSessionId(s.id)}
                            >
                              <span className="session-title-ellipsis">{s.title}</span>
                            </button>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          <footer className="sidebar-footnote" role="note">
            <p className="sidebar-footnote-text">{content.sidebar.handOffNote}</p>
          </footer>
        </aside>

        <section className="canvas">
          {activeWorkspace ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              style={{ display: "flex", flexDirection: "column", height: "100%" }}
            >
              <div className="toolbar">
                <div>
                  <h2 className="ws-title">{activeWorkspace.name}</h2>
                  <div className="stats">
                    <div className="stat-badge">{content.toolbar.statContext} <span>{contextDocs.length}</span></div>
                    <div className="stat-badge">{content.toolbar.statTemplates} <span>{templates.length}</span></div>
                    <div className="stat-badge">{content.toolbar.statSessions} <span>{sessions.length}</span></div>
                    <div className="stat-badge">
                      {content.toolbar.statArtifacts} <span>{activeSession?.pipeline_artifact_count ?? pipelineArtifacts.length}</span>
                    </div>
                  </div>
                  <div className="toolbar-specialist-toolbar" aria-live="polite">
                    <label className="toolbar-specialist-label" htmlFor="toolbar-specialist-select">
                      {content.toolbar.specialistBadge}
                    </label>
                    {sessionId && activeSession ? (
                      <select
                        id="toolbar-specialist-select"
                        className="toolbar-specialist-select"
                        value={activeSession.agent_type}
                        onChange={(e) => onUpdateSessionAgent(sessionId, e.target.value)}
                        title={content.toolbar.specialistSelectTitle}
                      >
                        {agentOptions.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="toolbar-specialist-value">{content.toolbar.specialistUnset}</span>
                    )}
                  </div>
                </div>

                <div className="view-toggles">
                  <button
                    type="button"
                    className={`toggle-btn ${viewMode === "wizard" ? "active" : ""}`}
                    onClick={() => setViewMode("wizard")}
                  >
                    <Workflow size={14} style={{ marginRight: 6, marginBottom: -2 }} aria-hidden="true" />
                    {content.toolbar.pipeline}
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${viewMode === "manager" ? "active" : ""}`}
                    onClick={() => setViewMode("manager")}
                  >
                    <Database size={14} style={{ marginRight: 6, marginBottom: -2 }} aria-hidden="true" />
                    {content.toolbar.storage}
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${viewMode === "observability" ? "active" : ""}`}
                    onClick={() => setViewMode("observability")}
                  >
                    <Activity size={14} style={{ marginRight: 6, marginBottom: -2 }} aria-hidden="true" />
                    {content.toolbar.observability}
                  </button>
                </div>
              </div>

              {viewMode === "wizard" ? (
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <nav className="wizard-nav" aria-label={content.wizard.progressAria}>
                    {stepNav.map((step, idx) => (
                      <div key={step.title} className="wizard-nav-col">
                        <button
                          type="button"
                          className={`wizard-nav-btn ${wizardStep === idx ? "is-current" : ""} ${wizardStep > idx ? "is-complete" : ""}`}
                          onClick={() => setWizardStep(idx)}
                          title={step.tooltip}
                        >
                          <span className="wizard-nav-num" aria-hidden="true">
                            {idx + 1}
                          </span>
                          <span className="wizard-nav-short">{step.short}</span>
                        </button>
                        <div className="step" aria-hidden="true">
                          <motion.div
                            className="step-fill"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: wizardStep >= idx ? 1 : 0 }}
                            transition={{ duration: 0.4 }}
                          />
                        </div>
                      </div>
                    ))}
                  </nav>
                  <p className="stepper-caption" role="status" aria-live="polite">
                    <span className="stepper-caption-title">
                      {content.wizard.stepCaption(wizardStep, stepNav.length, stepNav)}
                    </span>
                    <span className="stepper-caption-sub">{stepNav[wizardStep]?.subtitle}</span>
                  </p>

                  <AnimatePresence mode="wait">
                    {wizardStep === 0 && (
                      <motion.div key="step0" variants={fadeUp} initial="hidden" animate="visible" exit="exit" className="card">
                        <div className="card-header">
                          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Terminal color="var(--text-accent)" /> {content.wizard.step0.title}
                          </h3>
                        </div>
                        <div className="card-body">
                          <p style={{ fontSize: "16px", lineHeight: 1.6, color: "var(--text-muted)", margin: 0, maxWidth: "600px" }}>
                            {content.wizard.step0.intro}
                          </p>
                          <ul style={{ lineHeight: 2, marginTop: 32, fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>
                            {content.wizard.step0.listItems.map((item, idx) => (
                              <li key={item}>
                                <strong style={{ color: "var(--text-main)" }}>{content.wizard.step0.listPrefixes[idx]}</strong> {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="card-footer">
                          <div />
                          <button className="btn btn-primary" onClick={() => setWizardStep(1)}>
                            {content.wizard.step0.primaryCta} <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {wizardStep === 1 && (
                      <motion.div key="step1" variants={fadeUp} initial="hidden" animate="visible" exit="exit" className="card">
                        <div className="card-header">
                          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Database color="var(--text-accent)" /> {content.wizard.step1.title}
                          </h3>
                        </div>
                        <div className="card-body">
                          <div
                            className="dropzone"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              uploadManyContext(Array.from(e.dataTransfer.files || []));
                            }}
                          >
                            <FileUp size={48} className="dropzone-icon" />
                            <span style={{ fontSize: "16px", fontWeight: 700, marginBottom: 8 }}>{content.wizard.step1.dropTitle}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>{content.wizard.step1.dropSubtitle}</span>
                            <input className="usa-file-input" style={{ display: "none" }} id="context-file" type="file" multiple onChange={onUploadContext} />
                            <label htmlFor="context-file" className="btn" style={{ marginTop: 24 }}>{content.wizard.step1.browseFiles}</label>
                          </div>
                          
                          {contextDocs.length > 0 && (
                            <div className="item-list">
                              {contextDocs.map((d) => (
                                <div key={d.id} className="file-item">
                                  <FileText size={16} color="var(--text-muted)" />
                                  <span className="file-name">{d.filename}</span>
                                  <span className="file-tag">{d.kind}</span>
                                  <button className="btn-icon" style={{ width: 24, height: 24, border: "none" }} onClick={() => onDeleteContext(d.id)}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="card-footer">
                          <button className="btn" onClick={() => setWizardStep(0)}>{content.wizard.step1.abort}</button>
                          <button className="btn btn-primary" onClick={() => setWizardStep(2)}>
                            {content.wizard.step1.nextPhase} <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {wizardStep === 2 && (
                      <motion.div key="step2" variants={fadeUp} initial="hidden" animate="visible" exit="exit" className="card">
                        <div className="card-header">
                          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <LayoutTemplate color="var(--text-accent)" /> {content.wizard.step2.title}
                          </h3>
                        </div>
                        <div className="card-body">
                          <div
                            className="dropzone"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              uploadManyTemplates(Array.from(e.dataTransfer.files || []));
                            }}
                          >
                            <Box size={48} className="dropzone-icon" />
                            <span style={{ fontSize: "16px", fontWeight: 700, marginBottom: 8 }}>{content.wizard.step2.dropTitle}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>{content.wizard.step2.dropSubtitle}</span>
                            <input className="usa-file-input" style={{ display: "none" }} id="template-file" type="file" multiple accept=".docx,.pdf,.xlsx" onChange={onUploadTemplate} />
                            <label htmlFor="template-file" className="btn" style={{ marginTop: 24 }}>{content.wizard.step2.browseTemplates}</label>
                          </div>
                          
                          {templates.length > 0 && (
                            <div className="item-list">
                              {templates.map((t) => (
                                <div key={t.id} className="file-item" style={{ borderColor: activeTemplateId === t.id ? "var(--text-accent)" : "var(--border-color)" }}>
                                  <label className="radio-label">
                                    <input
                                      className="radio-input"
                                      type="radio"
                                      name="active-template"
                                      checked={activeTemplateId === t.id}
                                      onChange={() => onActivateTemplate(t.id)}
                                    />
                                    <span className="file-name" style={{ marginLeft: 0 }}>{t.filename}</span>
                                    {activeTemplateId === t.id && <span className="file-tag" style={{ background: "rgba(255, 51, 102, 0.1)", color: "var(--text-accent)", borderColor: "var(--text-accent)" }}>{content.wizard.step2.masterTag}</span>}
                                  </label>
                                  <button className="btn-icon" style={{ width: 24, height: 24, border: "none" }} onClick={() => onDeleteTemplate(t.id)}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {templates.length > 0 && agentOptions.length > 0 && (
                            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                              <h4 style={{ margin: 0, fontSize: 13, color: "var(--text-main)" }}>
                                {content.wizard.step2.specialistRoutingTitle}
                              </h4>
                              <p className="action-hint" style={{ margin: 0 }}>
                                {content.wizard.step2.specialistRoutingHint}
                              </p>
                              {agentOptions.map((a) => (
                                <div key={`route-${a.id}`} style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 10, alignItems: "center" }}>
                                  <label style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.name}</label>
                                  <select
                                    className="text-input"
                                    value={specialistTemplateMap[a.id] || ""}
                                    onChange={(e) => onAssignSpecialistTemplate(a.id, e.target.value)}
                                  >
                                    <option value="">{content.wizard.step2.specialistRoutingUseDefault}</option>
                                    {templates.map((t) => (
                                      <option key={`${a.id}-${t.id}`} value={t.id}>
                                        {t.filename}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="card-footer">
                          <button className="btn" onClick={() => setWizardStep(1)}>{content.wizard.step2.back}</button>
                          <button className="btn btn-primary" onClick={() => setWizardStep(3)}>
                            {content.wizard.step2.nextPhase} <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {wizardStep === 3 && (
                      <motion.div key="step3" variants={fadeUp} initial="hidden" animate="visible" exit="exit" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}>
                        <div className="wizard-step3-chatbar" role="region" aria-label={content.wizard.step3.chatRegionLabel}>
                          {sessionId ? (
                            <button
                              type="button"
                              className="btn wizard-step3-chat-toggle"
                              onClick={() => setChatDrawerOpen((open) => !open)}
                              aria-expanded={chatDrawerOpen}
                              aria-controls="session-chat-drawer-panel"
                            >
                              <Terminal size={16} aria-hidden="true" />
                              {chatDrawerOpen ? content.wizard.step3.closeChatDrawerLabel : content.wizard.step3.openChatDrawerLabel}
                            </button>
                          ) : (
                            <p className="action-hint" style={{ margin: 0 }}>{content.wizard.step3.sessionRequiredBanner}</p>
                          )}
                        </div>

                        <div className="wizard-step3-split" style={{ display: "flex", flexDirection: "row", flex: 1, minHeight: 0, gap: 0 }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px", minWidth: 0, overflow: "auto" }}>
                          <div className="card" style={{ flexShrink: 0 }}>
                            <div className="card-body" style={{ padding: "24px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <h4 style={{ margin: 0, fontSize: "14px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                                  {content.wizard.step3.synthesisTitle}
                                </h4>
                                <textarea
                                  className="text-input"
                                  style={{ width: "100%" }}
                                  value={instructions}
                                  onChange={(e) => setInstructions(e.target.value)}
                                  rows="2"
                                  placeholder={content.wizard.step3.instructionsPlaceholder}
                                />
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  <label htmlFor="workspace-default-template" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>
                                    {content.wizard.step3.defaultTemplateLabel}
                                  </label>
                                  {templates.length > 0 ? (
                                    <>
                                      <select
                                        id="workspace-default-template"
                                        className="text-input"
                                        style={{ maxWidth: "100%" }}
                                        value={activeTemplateId ?? ""}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          if (v) onActivateTemplate(v);
                                        }}
                                      >
                                        <option value="">{content.wizard.step3.templateSelectPlaceholder}</option>
                                        {templates.map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.filename}
                                          </option>
                                        ))}
                                      </select>
                                      <p className="action-hint">{content.wizard.step3.defaultTemplateHint}</p>
                                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)", marginTop: 6 }}>
                                        {content.wizard.step3.specialistTemplateRoutingLabel}
                                      </label>
                                      <p className="action-hint">{content.wizard.step3.specialistTemplateRoutingHint}</p>
                                      {agentOptions.map((a) => (
                                        <div key={`synth-route-${a.id}`} style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 10, alignItems: "center" }}>
                                          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.name}</label>
                                          <select
                                            className="text-input"
                                            value={specialistTemplateMap[a.id] || ""}
                                            onChange={(e) => onAssignSpecialistTemplate(a.id, e.target.value)}
                                          >
                                            <option value="">{content.wizard.step2.specialistRoutingUseDefault}</option>
                                            {templates.map((t) => (
                                              <option key={`synth-${a.id}-${t.id}`} value={t.id}>
                                                {t.filename}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      ))}
                                    </>
                                  ) : (
                                    <>
                                      <p className="action-hint">{content.wizard.step3.noTemplatesForExport}</p>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                                        <input
                                          className="usa-file-input"
                                          style={{ display: "none" }}
                                          id="quick-synth-template-upload"
                                          type="file"
                                          accept=".docx,.pdf,.xlsx"
                                          onChange={onUploadTemplate}
                                        />
                                        <label htmlFor="quick-synth-template-upload" className="btn">
                                          {content.wizard.step3.uploadTemplateQuickBrowse}
                                        </label>
                                        <button type="button" className="btn" onClick={() => setWizardStep(2)}>
                                          {content.wizard.step3.goToTemplateStep}
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div className="synthesis-actions">
                                  <div className="synthesis-action">
                                    <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={onGenerate} disabled={loading || !sessionId}>
                                      <Zap size={14} color="var(--text-accent)" aria-hidden="true" /> {content.wizard.step3.generateLabel}
                                    </button>
                                    <p className="action-hint">{content.wizard.step3.generateHint}</p>
                                  </div>
                                  <div className="synthesis-action">
                                    <button
                                      className="btn"
                                      style={{ width: "100%", justifyContent: "center" }}
                                      onClick={onDownloadAllArtifacts}
                                      disabled={loading || !sessionId || !hasDraftContent}
                                      type="button"
                                    >
                                      <FileText size={14} aria-hidden="true" /> {content.wizard.step3.downloadAllArtifactsLabel}
                                    </button>
                                    <p className="action-hint">{content.wizard.step3.downloadAllArtifactsHint}</p>
                                  </div>
                                  <div className="synthesis-action">
                                    <button
                                      className="btn btn-primary"
                                      style={{ width: "100%", justifyContent: "center" }}
                                      onClick={onMergeDownload}
                                      disabled={loading || !sessionId || !activeTemplateId}
                                      type="button"
                                    >
                                      <FileDown size={14} aria-hidden="true" /> {content.wizard.step3.downloadLabel}
                                    </button>
                                    <p className="action-hint">{content.wizard.step3.downloadHint}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="card" style={{ flexShrink: 0 }}>
                            <div className="card-body" style={{ padding: "24px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  marginBottom: 12,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <Workflow size={16} color="var(--text-accent)" aria-hidden="true" />
                                  <h4
                                    style={{
                                      margin: 0,
                                      fontSize: "14px",
                                      fontFamily: "var(--font-mono)",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                      color: "var(--text-muted)",
                                    }}
                                    id="specialist-pipeline-heading"
                                  >
                                    {content.wizard.step3.pipelineHeading}
                                  </h4>
                                </div>
                                {sessionId && pipelinePlan.length > 0 ? (
                                  <div
                                    className="pipeline-pills"
                                    role="group"
                                    aria-label="Pipeline phase progress and stored artifacts"
                                  >
                                    <span
                                      className="artifact-pill artifact-pill--progress"
                                      title={content.wizard.step3.progressPillTitle}
                                    >
                                      {content.wizard.step3.progressPill(
                                        pipelineProgressCounts.completed,
                                        pipelineProgressCounts.total,
                                      )}
                                    </span>
                                    <span
                                      className="artifact-pill artifact-pill--ready"
                                      title={content.wizard.step3.artifactsReadyPillTitle}
                                    >
                                      {content.wizard.step3.artifactsReadyPill(pipelineArtifacts.length)}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                              {!sessionId ? (
                                <p className="action-hint" style={{ margin: 0 }}>
                                  {content.wizard.step3.sessionRequiredBanner}
                                </p>
                              ) : pipelineUi.totalPhases === 0 ? (
                                <p className="action-hint" style={{ margin: 0 }}>
                                  {content.wizard.step3.pipelineDefinitionLoading}
                                </p>
                              ) : (
                                <>
                                  <p className="action-hint" style={{ marginTop: 0 }}>
                                    {content.wizard.step3.pipelineInstructionsNote}
                                  </p>
                                  <p className="action-hint" style={{ marginTop: 0 }}>
                                    {content.wizard.step3.pipelineFixedOrderNote}
                                  </p>
                                  <div
                                    role="group"
                                    aria-labelledby="orch-mode-label"
                                    style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}
                                  >
                                    <span
                                      id="orch-mode-label"
                                      style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}
                                    >
                                      {content.wizard.step3.pipelineOrchestrationLabel}
                                    </span>
                                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                                      <input
                                        type="radio"
                                        name="orch-mode"
                                        checked={(activeSession?.orchestration_mode || "manual_review") === "manual_review"}
                                        onChange={() => onOrchestrationModeChange("manual_review")}
                                        disabled={loading}
                                      />
                                      <span>
                                        <span style={{ display: "block", fontWeight: 600 }}>{content.wizard.step3.pipelineModeManual}</span>
                                        <span className="action-hint" style={{ margin: 0 }}>
                                          {content.wizard.step3.pipelineModeManualHint}
                                        </span>
                                      </span>
                                    </label>
                                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                                      <input
                                        type="radio"
                                        name="orch-mode"
                                        checked={(activeSession?.orchestration_mode || "manual_review") === "automatic"}
                                        onChange={() => onOrchestrationModeChange("automatic")}
                                        disabled={loading}
                                      />
                                      <span>
                                        <span style={{ display: "block", fontWeight: 600 }}>{content.wizard.step3.pipelineModeAuto}</span>
                                        <span className="action-hint" style={{ margin: 0 }}>
                                          {content.wizard.step3.pipelineModeAutoHint}
                                        </span>
                                      </span>
                                    </label>
                                  </div>

                                  <div className="pipeline-timeline" role="status" aria-live="polite">
                                    {pipelinePlan.map((phase, i) => {
                                      const row = pipelinePhaseRowModel({
                                        phaseIndex: i,
                                        pipelinePlan,
                                        activeSession,
                                        loading,
                                        clarActive: pipelineUi.clarActive,
                                        manualPause: pipelineUi.manualPause,
                                        pipelineDone: pipelineUi.pipelineDone,
                                        p3: content.wizard.step3,
                                      });
                                      return (
                                        <div key={phase.agent_id} className={`pipeline-phase ${row.statusClass}`}>
                                          <div className="phase-indicator">
                                            <div className={`phase-dot ${row.showPulse ? "pulsing" : ""}`} />
                                            <div className="phase-line" />
                                          </div>
                                          <div className="phase-details">
                                            <div className="phase-name">
                                              <SpecialistAvatar agentId={phase.agent_id} emphasize={row.showPulse} />
                                              <span className="phase-name-text">{phase.name}</span>
                                            </div>
                                            <div className="phase-status" aria-label={`${phase.name}: ${row.primary}`}>
                                              <div className="phase-status-primary">{row.primary}</div>
                                              {row.detail.map((line, j) => (
                                                <div key={j} className="phase-status-detail">
                                                  {line}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {pipelineUi.manualPause ? (
                                      <p className="action-hint" style={{ marginTop: 8, color: "var(--text-accent)" }}>{content.wizard.step3.pipelineBlockedManual}</p>
                                    ) : null}
                                    {pipelineUi.clarActive ? (
                                      <p className="action-hint" style={{ marginTop: 8, color: "var(--text-accent)" }}>{content.wizard.step3.pipelineClarificationHint}</p>
                                    ) : null}
                                  </div>

                                  {pipelineUi.clarActive ? (
                                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, cursor: "pointer" }}>
                                      <input
                                        type="checkbox"
                                        checked={clarificationResolved}
                                        onChange={(e) => setClarificationResolved(e.target.checked)}
                                        disabled={loading}
                                      />
                                      <span style={{ fontSize: 14 }}>{content.wizard.step3.pipelineClarificationResolvedLabel}</span>
                                    </label>
                                  ) : null}

                                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <button
                                      type="button"
                                      className="btn"
                                      style={{ width: "100%", justifyContent: "center" }}
                                      onClick={() => {
                                        if (!sessionId) {
                                          showNotice("Please select or create a session first.");
                                          return;
                                        }
                                        if (pipelineUi.pipelineDone) {
                                          showNotice("The pipeline has already finished. Reset progress to run again.");
                                          return;
                                        }
                                        if (pipelineUi.clarActive && !clarificationResolved) {
                                          showNotice("Please resolve the clarification in the chat and check the box before continuing.");
                                          return;
                                        }
                                        onPipelineAdvance("single_phase");
                                      }}
                                      disabled={loading}
                                    >
                                      {content.wizard.step3.pipelineRunNext}
                                    </button>
                                    {pipelineUi.orch === "automatic" ? (
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        style={{ width: "100%", justifyContent: "center" }}
                                        onClick={() => {
                                          if (!sessionId) {
                                            showNotice("Please select or create a session first.");
                                            return;
                                          }
                                          if (pipelineUi.pipelineDone) {
                                            showNotice("The pipeline has already finished. Reset progress to run again.");
                                            return;
                                          }
                                          if (pipelineUi.clarActive && !clarificationResolved) {
                                            showNotice("Please resolve the clarification in the chat and check the box before continuing.");
                                            return;
                                          }
                                          onPipelineAdvance("auto_chain");
                                        }}
                                        disabled={loading}
                                      >
                                        {content.wizard.step3.pipelineRunChain}
                                      </button>
                                    ) : null}
                                    <p className="action-hint" style={{ margin: 0 }}>
                                      {content.wizard.step3.pipelineApproveHint}
                                    </p>
                                    <button
                                      type="button"
                                      className="btn"
                                      style={{ width: "100%", justifyContent: "center" }}
                                      onClick={onPipelineResetClick}
                                      disabled={loading || !sessionId}
                                    >
                                      {content.wizard.step3.pipelineResetLabel}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: "200px" }}>
                            <div className="card-header" style={{ padding: "16px 24px" }}>
                              <h3 className="card-title" style={{ fontSize: 14 }}>{content.wizard.step3.outputBufferTitle}</h3>
                            </div>
                            <div className="card-body markdown-draft-body" style={{ padding: "0 24px 24px", overflow: "auto", flex: 1 }}>
                              {previewMarkdown ? (
                                <div className="markdown-draft-view">
                                  <ReactMarkdown>{previewMarkdown}</ReactMarkdown>
                                </div>
                              ) : (
                                <p className="preview-placeholder">{content.wizard.step3.outputEmpty}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {chatDrawerOpen && sessionId ? (
                            <motion.aside
                              id="session-chat-drawer-panel"
                              key="session-chat-drawer"
                              className="chat-drawer-panel"
                              initial={{ opacity: 0, x: 48 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 48 }}
                              transition={{ duration: 0.22 }}
                              aria-labelledby="chat-drawer-title"
                            >
                              <div className="chat-drawer-header">
                                <h3 className="chat-drawer-title" id="chat-drawer-title">
                                  <Terminal size={16} aria-hidden="true" /> {content.wizard.step3.terminalTitle}
                                </h3>
                                <button
                                  type="button"
                                  className="btn-icon chat-drawer-close"
                                  onClick={() => setChatDrawerOpen(false)}
                                  aria-label={content.wizard.step3.closeChatDrawerLabel}
                                >
                                  <X size={18} aria-hidden="true" />
                                </button>
                              </div>
                              <div className="chat-drawer-body">
                                <div className="chat-container chat-container--drawer">
                                  <div className="chat-history chat-history--drawer">
                                    {messages.length === 0 ? (
                                      <div className="chat-empty-hint">{content.wizard.step3.terminalEmpty}</div>
                                    ) : null}
                                    {messages.map((m) => (
                                      <div key={m.id} className={`chat-bubble ${m.role}`}>
                                        <div className="bubble-role">{m.role === "assistant" ? content.wizard.step3.roleAssistant : content.wizard.step3.roleUser}</div>
                                        <div className="chat-bubble__text">
                                          <ReactMarkdown>{m.content}</ReactMarkdown>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <form className="chat-drawer-form" onSubmit={onSendMessage}>
                                    <label htmlFor="chat-drawer-message" className="sr-only-label">
                                      {content.wizard.step3.chatMessageLabel}
                                    </label>
                                    <div className="input-group">
                                      <textarea
                                        id="chat-drawer-message"
                                        className="text-input"
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        rows={3}
                                        placeholder={content.wizard.step3.messagePlaceholder}
                                      />
                                      <button className="btn" disabled={loading || !sessionId}>{content.wizard.step3.transmit}</button>
                                    </div>
                                  </form>
                                </div>
                              </div>
                            </motion.aside>
                          ) : null}
                        </AnimatePresence>
                        </div>

                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : viewMode === "manager" ? (
                <>
                <div className="grid-2">
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Database color="var(--text-accent)" /> {content.manager.contextTitle}
                      </h3>
                    </div>
                    <div className="card-body" style={{ overflowY: "auto" }}>
                      <div
                        className="dropzone"
                        style={{ padding: "24px" }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          uploadManyContext(Array.from(e.dataTransfer.files || []));
                        }}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 700 }}>{content.manager.dropSourceMaterials}</span>
                        <input className="usa-file-input" style={{ display: "none" }} id="context-mgr" type="file" multiple onChange={onUploadContext} />
                        <label htmlFor="context-mgr" className="btn" style={{ marginTop: 12 }}>{content.manager.browse}</label>
                      </div>
                      
                      {contextDocs.length > 0 && (
                        <div className="item-list">
                          {contextDocs.map((d) => (
                            <div key={d.id} className="file-item">
                              <FileText size={16} color="var(--text-muted)" />
                              <span className="file-name">{d.filename}</span>
                              <button className="btn-icon" style={{ width: 24, height: 24, border: "none" }} onClick={() => onDeleteContext(d.id)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <LayoutTemplate color="var(--text-accent)" /> {content.manager.templatesTitle}
                      </h3>
                    </div>
                    <div className="card-body" style={{ overflowY: "auto" }}>
                      <div
                        className="dropzone"
                        style={{ padding: "24px" }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          uploadManyTemplates(Array.from(e.dataTransfer.files || []));
                        }}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 700 }}>{content.manager.dropDocxTemplates}</span>
                        <input className="usa-file-input" style={{ display: "none" }} id="tpl-mgr" type="file" multiple accept=".docx,.pdf,.xlsx" onChange={onUploadTemplate} />
                        <label htmlFor="tpl-mgr" className="btn" style={{ marginTop: 12 }}>{content.manager.browse}</label>
                      </div>
                      
                      {templates.length > 0 && (
                        <div className="item-list">
                          {templates.map((t) => (
                            <div key={t.id} className="file-item" style={{ borderColor: activeTemplateId === t.id ? "var(--text-accent)" : "var(--border-color)" }}>
                              <label className="radio-label">
                                <input
                                  className="radio-input"
                                  type="radio"
                                  name="active-template-mgr"
                                  checked={activeTemplateId === t.id}
                                  onChange={() => onActivateTemplate(t.id)}
                                />
                                <span className="file-name" style={{ marginLeft: 0 }}>{t.filename}</span>
                              </label>
                              <button className="btn-icon" style={{ width: 24, height: 24, border: "none" }} onClick={() => onDeleteTemplate(t.id)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card manager-artifacts-card">
                  <div className="card-header">
                    <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Workflow color="var(--text-accent)" aria-hidden="true" /> {content.manager.pipelineArtifactsTitle}
                    </h3>
                  </div>
                  <div className="card-body">
                    <p className="action-hint" style={{ marginTop: 0 }}>
                      {content.manager.pipelineArtifactsIntro}
                    </p>
                    {!sessionId ? (
                      <p className="action-hint">{content.manager.pipelineArtifactsNoSession}</p>
                    ) : (
                      <>
                        <p className="action-hint" style={{ marginBottom: 12 }}>
                          <strong>{content.manager.pipelineArtifactsSessionLabel}:</strong>{" "}
                          {sessions.find((s) => s.id === sessionId)?.title || sessionId}
                        </p>
                        {pipelineArtifacts.length === 0 ? (
                          <p className="action-hint">{content.manager.pipelineArtifactsEmpty}</p>
                        ) : (
                          <ul className="pipeline-artifact-download-list">
                            {pipelineArtifacts.map((a) => (
                              <li key={`${a.phase_order}-${a.agent_id}`} className="pipeline-artifact-download-item">
                                <div>
                                  <div className="pipeline-artifact-download-name">{a.phase_name}</div>
                                  <div className="pipeline-artifact-download-meta">
                                    {a.artifact_filename}
                                    {a.summary ? ` — ${a.summary}` : ""}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="btn"
                                  style={{ flexShrink: 0 }}
                                  onClick={async () => {
                                    if (!a.download_url) return;
                                    try {
                                      await downloadFileByPath(a.download_url);
                                    } catch (e) {
                                      showNotice(e.message);
                                    }
                                  }}
                                >
                                  <FileDown size={14} aria-hidden="true" /> {content.manager.pipelineArtifactsDownloadOne}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {pipelineArtifacts.length > 0 ? (
                          <button
                            type="button"
                            className="btn"
                            style={{ marginTop: 16 }}
                            onClick={async () => {
                              if (!workspaceId || !sessionId) return;
                              try {
                                await downloadFileByPath(
                                  `/workspaces/${workspaceId}/sessions/${sessionId}/pipeline/artifacts/all/download`,
                                );
                                showNotice(content.notices.artifactsExportReady);
                              } catch (e) {
                                showNotice(e.message);
                              }
                            }}
                          >
                            <FileText size={14} aria-hidden="true" /> {content.manager.pipelineArtifactsDownloadAll}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                </>
              ) : (
                <div className="observability-panel" style={{ padding: "0 8px 24px", flex: 1, overflow: "auto" }}>
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Activity color="var(--text-accent)" aria-hidden="true" /> {content.observability.pageTitle}
                      </h3>
                    </div>
                    <div className="card-body">
                      <p className="action-hint" style={{ marginTop: 0 }}>
                        {content.observability.pageIntro}
                      </p>
                      <p className="action-hint">{content.observability.requirementsRolesNote}</p>
                      <div style={{ overflowX: "auto" }}>
                        <table className="ops-matrix-table">
                          <caption className="sr-only-label">{content.observability.tableCaption}</caption>
                          <thead>
                            <tr>
                              <th scope="col">{content.observability.colArea}</th>
                              <th scope="col">{content.observability.colStatus}</th>
                              <th scope="col">{content.observability.colAction}</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>{content.observability.rowPipelineName}</td>
                              <td>{content.observability.rowPipelineStatus}</td>
                              <td>{content.observability.rowPipelineAction}</td>
                            </tr>
                            <tr>
                              <td>{content.observability.rowStorageName}</td>
                              <td>{content.observability.rowStorageStatus(contextDocs.length, templates.length)}</td>
                              <td>{content.observability.rowStorageAction}</td>
                            </tr>
                            <tr>
                              <td>{content.observability.rowObsName}</td>
                              <td>
                                {observabilityStatus?.langsmith_tracing_enabled
                                  ? content.observability.rowObsOn
                                  : content.observability.rowObsOff}
                                {observabilityStatus?.langchain_project
                                  ? ` ${content.observability.rowObsProject(observabilityStatus.langchain_project)}`
                                  : ""}
                              </td>
                              <td>
                                <a
                                  href={
                                    import.meta.env.VITE_LANGSMITH_PROJECT_URL ||
                                    observabilityStatus?.langsmith_ui_base ||
                                    "https://smith.langchain.com"
                                  }
                                  className="usa-link"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {content.observability.openLangSmith}
                                  <span className="usa-sr-only"> (opens in new tab)</span>
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              <Activity size={48} style={{ opacity: 0.2, marginBottom: 24 }} />
              <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "16px", letterSpacing: "0.1em", margin: "0 0 8px 0" }}>{content.emptyState.title}</h2>
              <p style={{ margin: 0, fontSize: "14px" }}>{content.emptyState.subtitle}</p>
            </div>
          )}
        </section>
      </main>

      {settingsOpen && activeWorkspace ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSettingsOpen(false);
          }}
        >
          <div
            className="modal-card modal-card-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card-header">
              <h2 id="settings-modal-title" className="modal-title">
                <Settings size={20} aria-hidden="true" style={{ marginRight: 8, verticalAlign: "middle" }} />
                {content.settings.panelTitle}
              </h2>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSettingsOpen(false)}
                aria-label={content.settings.cancel}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="modal-explainer">{content.settings.smartsExplainer}</p>
            <form className="modal-form" onSubmit={onSaveWorkspaceAgentSettings}>
              <label htmlFor="agent-temp-input" className="modal-label">
                {content.settings.temperatureLabel}
              </label>
              <input
                id="agent-temp-input"
                className="text-input"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={settingsTemp}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setSettingsTemp(Number.isFinite(v) ? v : 0.2);
                }}
              />
              <p className="action-hint" style={{ marginTop: 4 }}>
                {content.settings.temperatureHint}
              </p>
              <label htmlFor="agent-guidance-input" className="modal-label">
                {content.settings.guidanceLabel}
              </label>
              <textarea
                id="agent-guidance-input"
                className="text-input"
                rows={6}
                value={settingsGuidance}
                onChange={(e) => setSettingsGuidance(e.target.value)}
              />
              <p className="action-hint" style={{ marginTop: 4 }}>
                {content.settings.guidanceHint}
              </p>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setSettingsOpen(false)}>
                  {content.settings.cancel}
                </button>
                <button type="submit" className="btn btn-primary">
                  {content.settings.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
