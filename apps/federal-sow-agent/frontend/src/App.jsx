import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  Box,
  ChevronRight,
  Database,
  FileDown,
  FileText,
  FileUp,
  FolderOpen,
  LayoutTemplate,
  Terminal,
  Plus,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";
import { api, ApiError } from "./api";
import { content } from "./content";

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
  const [newSessionAgentType, setNewSessionAgentType] = useState("sow_writer");
  const [wizardStep, setWizardStep] = useState(0);
  const [viewMode, setViewMode] = useState("wizard"); // wizard | manager

  const agentOptions = agentsCatalog.length
    ? agentsCatalog
    : [{ id: "sow_writer", name: "SOW/PWS Writer", description: "" }];

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId) || null,
    [workspaces, workspaceId],
  );
  const activeTemplateId = activeWorkspace?.active_template_asset_id || null;
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

  function specialistDisplayName(agentTypeId) {
    if (!agentTypeId) return "";
    const name = agentsCatalog.find((a) => a.id === agentTypeId)?.name;
    return name || agentTypeId;
  }

  useEffect(() => {
    loadWorkspaces().catch(() => {});
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
    setClarificationResolved(false);
  }, [sessionId]);

  useEffect(() => {
    setSessionId(null);
    setMessages([]);
    setGeneration(null);
  }, [workspaceId]);

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

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 5000);
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
    try {
      const s = await api.createSession(workspaceId, content.prompts.newSessionTitle, newSessionAgentType);
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
      const merged = await api.merge(workspaceId, sessionId, activeTemplateId);
      window.open(api.downloadUrl(merged.download_path), "_blank", "noopener");
      showNotice(content.notices.exportReady);
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
          <div className="logo-mark" />
          <h1 className="app-title">{content.header.appTitle}</h1>
        </div>
        <div className="user-badge">
          <Activity size={14} color="var(--text-accent)" />
          <span>{content.header.userBadge}</span>
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
                      <div className="new-session-row">
                        <label htmlFor={`new-session-agent-${ws.id}`} className="new-session-agent-label">
                          {content.sidebar.specialistForNextSessionLabel}
                        </label>
                        <select
                          id={`new-session-agent-${ws.id}`}
                          className="session-agent-picker"
                          value={newSessionAgentType}
                          onChange={(e) => setNewSessionAgentType(e.target.value)}
                        >
                          {agentOptions.map((a) => (
                            <option key={a.id} value={a.id} title={a.description}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
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
                            <select
                              className="session-agent-picker session-agent-picker-compact"
                              aria-label={`${content.sidebar.changeSpecialistAria}: ${s.title}`}
                              title={agentOptions.find((a) => a.id === s.agent_type)?.description ?? ""}
                              value={s.agent_type}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onUpdateSessionAgent(s.id, e.target.value)}
                            >
                              {agentOptions.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
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
                  </div>
                  <div className="toolbar-specialist" aria-live="polite">
                    <span className="toolbar-specialist-label">{content.toolbar.specialistBadge}</span>
                    <span className="toolbar-specialist-value">
                      {activeSession?.agent_type
                        ? specialistDisplayName(activeSession.agent_type)
                        : content.toolbar.specialistUnset}
                    </span>
                  </div>
                </div>

                <div className="view-toggles">
                  <button
                    className={`toggle-btn ${viewMode === "wizard" ? "active" : ""}`}
                    onClick={() => setViewMode("wizard")}
                  >
                    <Workflow size={14} style={{ marginRight: 6, marginBottom: -2 }} /> 
                    {content.toolbar.pipeline}
                  </button>
                  <button
                    className={`toggle-btn ${viewMode === "manager" ? "active" : ""}`}
                    onClick={() => setViewMode("manager")}
                  >
                    <Database size={14} style={{ marginRight: 6, marginBottom: -2 }} />
                    {content.toolbar.storage}
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
                            <input className="usa-file-input" style={{ display: "none" }} id="template-file" type="file" multiple accept=".docx" onChange={onUploadTemplate} />
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
                      <motion.div key="step3" variants={fadeUp} initial="hidden" animate="visible" exit="exit" style={{ display: "flex", gap: "24px", flex: 1, minHeight: 0 }}>
                        
                        <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                          <div className="card-header" style={{ padding: "16px 24px" }}>
                            <h3 className="card-title" style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 12 }}>
                              <Terminal size={16} color="var(--text-accent)" /> {content.wizard.step3.terminalTitle}
                            </h3>
                          </div>
                          
                          <div className="card-body" style={{ padding: 0, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                            {!sessionId ? (
                              <div className="session-alert" role="status">
                                {content.wizard.step3.sessionRequiredBanner}
                              </div>
                            ) : null}
                            <div className="chat-container">
                              <div className="chat-history" style={{ border: "none", borderRadius: 0, margin: 0, flex: 1 }}>
                                {messages.length === 0 ? (
                                  <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                                    {content.wizard.step3.terminalEmpty}
                                  </div>
                                ) : null}
                                {messages.map((m) => (
                                  <div key={m.id} className={`chat-bubble ${m.role}`}>
                                    <div className="bubble-role">{m.role === "assistant" ? content.wizard.step3.roleAssistant : content.wizard.step3.roleUser}</div>
                                    <div className="chat-bubble__text">{m.content}</div>
                                  </div>
                                ))}
                              </div>
                              
                              <form style={{ padding: "16px 24px", borderTop: "1px solid var(--border-color)", background: "var(--bg-panel)" }} onSubmit={onSendMessage}>
                                <div className="input-group">
                                  <textarea
                                    className="text-input"
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    rows="1"
                                    placeholder={content.wizard.step3.messagePlaceholder}
                                  />
                                  <button className="btn" disabled={loading || !sessionId}>{content.wizard.step3.transmit}</button>
                                </div>
                              </form>
                            </div>
                          </div>
                        </div>

                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
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
                                <div className="synthesis-actions">
                                  <div className="synthesis-action">
                                    <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={onGenerate} disabled={loading || !sessionId}>
                                      <Zap size={14} color="var(--text-accent)" aria-hidden="true" /> {content.wizard.step3.generateLabel}
                                    </button>
                                    <p className="action-hint">{content.wizard.step3.generateHint}</p>
                                  </div>
                                  <div className="synthesis-action">
                                    <button
                                      className="btn btn-primary"
                                      style={{ width: "100%", justifyContent: "center" }}
                                      onClick={onMergeDownload}
                                      disabled={loading || !sessionId || !activeTemplateId}
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
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
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

                                  <div
                                    role="status"
                                    aria-live="polite"
                                    style={{
                                      padding: "12px 14px",
                                      marginBottom: 14,
                                      border: "1px solid var(--border-color)",
                                      borderRadius: 4,
                                      fontFamily: "var(--font-mono)",
                                      fontSize: 12,
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    <div>{pipelineUi.progressLine}</div>
                                    {pipelineUi.statusLabel ? (
                                      <div style={{ marginTop: 6, color: "var(--text-accent)" }}>{pipelineUi.statusLabel}</div>
                                    ) : null}
                                    {pipelineUi.nextName ? (
                                      <div style={{ marginTop: 6 }}>Next specialist: {pipelineUi.nextName}</div>
                                    ) : null}
                                    {pipelineUi.manualPause ? (
                                      <div style={{ marginTop: 8 }}>{content.wizard.step3.pipelineBlockedManual}</div>
                                    ) : null}
                                    {pipelineUi.clarActive ? (
                                      <div style={{ marginTop: 8 }}>{content.wizard.step3.pipelineClarificationHint}</div>
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
                                      onClick={() => onPipelineAdvance("single_phase")}
                                      disabled={
                                        loading ||
                                        !sessionId ||
                                        pipelineUi.pipelineDone ||
                                        (pipelineUi.clarActive && !clarificationResolved)
                                      }
                                    >
                                      {content.wizard.step3.pipelineRunNext}
                                    </button>
                                    {pipelineUi.orch === "automatic" ? (
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        style={{ width: "100%", justifyContent: "center" }}
                                        onClick={() => onPipelineAdvance("auto_chain")}
                                        disabled={
                                          loading ||
                                          !sessionId ||
                                          pipelineUi.pipelineDone ||
                                          (pipelineUi.clarActive && !clarificationResolved)
                                        }
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
                              {generation?.sections?.full_markdown ? (
                                <div className="markdown-draft-view">
                                  <ReactMarkdown>{generation.sections.full_markdown}</ReactMarkdown>
                                </div>
                              ) : (
                                <p className="preview-placeholder">{content.wizard.step3.outputEmpty}</p>
                              )}
                            </div>
                          </div>
                        </div>

                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
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
                        <input className="usa-file-input" style={{ display: "none" }} id="tpl-mgr" type="file" multiple onChange={onUploadTemplate} />
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
    </div>
  );
}

export default App;
