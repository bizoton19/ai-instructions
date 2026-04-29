import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Box,
  ChevronRight,
  Database,
  FileText,
  FileUp,
  FolderOpen,
  LayoutTemplate,
  MessageSquareTerminal,
  Plus,
  TerminalSquare,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";
import { api } from "./api";

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
  const [wizardStep, setWizardStep] = useState(0);
  const [viewMode, setViewMode] = useState("wizard"); // wizard | manager

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId) || null,
    [workspaces, workspaceId],
  );
  const activeTemplateId = activeWorkspace?.active_template_asset_id || null;

  useEffect(() => {
    loadWorkspaces().catch(() => {});
  }, []);

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
    if (s.length > 0 && !s.find((x) => x.id === sessionId)) {
      setSessionId(s[0].id);
    }
  }

  useEffect(() => {
    if (!workspaceId) return;
    refreshWorkspaceData(workspaceId).catch((e) => showNotice(e.message));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !sessionId) return;
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
    const name = prompt("Workspace name") || "Default Workspace";
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
      const s = await api.createSession(workspaceId, "New Session");
      const next = await api.listSessions(workspaceId);
      setSessions(next);
      setSessionId(s.id);
    } catch (e) {
      showNotice(e.message);
    }
  }

  async function uploadManyContext(files) {
    if (!files?.length || !workspaceId) return;
    setLoading(true);
    try {
      for (const file of files) {
        await api.uploadContext(workspaceId, file);
      }
      await refreshWorkspaceData(workspaceId);
      showNotice(`Uploaded ${files.length} context file(s).`);
    } catch (err) {
      showNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadManyTemplates(files) {
    if (!files?.length || !workspaceId) return;
    setLoading(true);
    try {
      for (const file of files) {
        await api.uploadTemplate(workspaceId, file);
      }
      await refreshWorkspaceData(workspaceId);
      showNotice(`Uploaded ${files.length} template file(s).`);
    } catch (err) {
      showNotice(err.message);
    } finally {
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
    showNotice("Active template updated.");
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
    setLoading(true);
    try {
      const result = await api.generate(workspaceId, sessionId, instructions);
      setGeneration(result);
      setMessages(await api.listMessages(workspaceId, sessionId));
      showNotice("Draft Generation Successful.");
    } catch (err) {
      showNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onMergeDownload() {
    if (!workspaceId || !sessionId || !activeTemplateId) return;
    setLoading(true);
    try {
      const merged = await api.merge(workspaceId, sessionId, activeTemplateId);
      window.open(api.downloadUrl(merged.download_path), "_blank", "noopener");
      showNotice("Export ready.");
    } catch (err) {
      showNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  const steps = ["Initialization", "Ingestion", "Formatting", "Synthesis"];

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
              <span style={{ color: "var(--text-accent)", marginRight: "8px" }}>//</span>
              {notice}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="top-nav">
        <div className="logo-section">
          <div className="logo-mark" />
          <h1 className="app-title">SOW // Assembly Engine</h1>
        </div>
        <div className="user-badge">
          <Activity size={14} color="var(--text-accent)" />
          <span>System Active</span>
        </div>
      </header>

      <main className="main-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2 className="sidebar-title">Workspaces</h2>
            <button className="btn-icon" onClick={onCreateWorkspace} title="Initialize Workspace">
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
                      title="New Session"
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
                        <div style={{ padding: "8px 24px 8px 48px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          No sessions active.
                        </div>
                      ) : (
                        sessions.map((s) => (
                          <button 
                            key={s.id}
                            className={`session-item ${sessionId === s.id ? "active" : ""}`}
                            onClick={() => setSessionId(s.id)}
                          >
                            {s.title}
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
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
                    <div className="stat-badge">CONTEXT <span>{contextDocs.length}</span></div>
                    <div className="stat-badge">TEMPLATES <span>{templates.length}</span></div>
                    <div className="stat-badge">SESSIONS <span>{sessions.length}</span></div>
                  </div>
                </div>

                <div className="view-toggles">
                  <button
                    className={`toggle-btn ${viewMode === "wizard" ? "active" : ""}`}
                    onClick={() => setViewMode("wizard")}
                  >
                    <Workflow size={14} style={{ marginRight: 6, marginBottom: -2 }} /> 
                    Pipeline
                  </button>
                  <button
                    className={`toggle-btn ${viewMode === "manager" ? "active" : ""}`}
                    onClick={() => setViewMode("manager")}
                  >
                    <Database size={14} style={{ marginRight: 6, marginBottom: -2 }} />
                    Storage
                  </button>
                </div>
              </div>

              {viewMode === "wizard" ? (
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div className="stepper">
                    {steps.map((label, idx) => (
                      <div key={idx} className="step" title={label}>
                        <motion.div 
                          className="step-fill"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: wizardStep >= idx ? 1 : 0 }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    {wizardStep === 0 && (
                      <motion.div key="step0" variants={fadeUp} initial="hidden" animate="visible" exit="exit" className="card">
                        <div className="card-header">
                          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <TerminalSquare color="var(--text-accent)" /> System Initialization
                          </h3>
                        </div>
                        <div className="card-body">
                          <p style={{ fontSize: "16px", lineHeight: 1.6, color: "var(--text-muted)", margin: 0, maxWidth: "600px" }}>
                            The Assembly Engine synthesizes provided data sources into compliant, highly-structured output documents utilizing your master templates.
                          </p>
                          <ul style={{ lineHeight: 2, marginTop: 32, fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>
                            <li><strong style={{ color: "var(--text-main)" }}>01.</strong> Ingest contextual data layers (PDF, Docs, CSV).</li>
                            <li><strong style={{ color: "var(--text-main)" }}>02.</strong> Designate structural output templates.</li>
                            <li><strong style={{ color: "var(--text-main)" }}>03.</strong> Command the synthesis sequence.</li>
                            <li><strong style={{ color: "var(--text-main)" }}>04.</strong> Export localized data packet.</li>
                          </ul>
                        </div>
                        <div className="card-footer">
                          <div />
                          <button className="btn btn-primary" onClick={() => setWizardStep(1)}>
                            Initialize Sequence <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {wizardStep === 1 && (
                      <motion.div key="step1" variants={fadeUp} initial="hidden" animate="visible" exit="exit" className="card">
                        <div className="card-header">
                          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Database color="var(--text-accent)" /> Context Ingestion
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
                            <span style={{ fontSize: "16px", fontWeight: 700, marginBottom: 8 }}>Drop Source Materials</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>PDF, DOCX, XLSX, CSV, TXT</span>
                            <input className="usa-file-input" style={{ display: "none" }} id="context-file" type="file" multiple onChange={onUploadContext} />
                            <label htmlFor="context-file" className="btn" style={{ marginTop: 24 }}>Browse Files</label>
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
                          <button className="btn" onClick={() => setWizardStep(0)}>Abort</button>
                          <button className="btn btn-primary" onClick={() => setWizardStep(2)}>
                            Next Phase <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {wizardStep === 2 && (
                      <motion.div key="step2" variants={fadeUp} initial="hidden" animate="visible" exit="exit" className="card">
                        <div className="card-header">
                          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <LayoutTemplate color="var(--text-accent)" /> Structure Designation
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
                            <span style={{ fontSize: "16px", fontWeight: 700, marginBottom: 8 }}>Drop Master Templates</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>DOCX Format Required</span>
                            <input className="usa-file-input" style={{ display: "none" }} id="template-file" type="file" multiple accept=".docx" onChange={onUploadTemplate} />
                            <label htmlFor="template-file" className="btn" style={{ marginTop: 24 }}>Browse Templates</label>
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
                                    {activeTemplateId === t.id && <span className="file-tag" style={{ background: "rgba(255, 51, 102, 0.1)", color: "var(--text-accent)", borderColor: "var(--text-accent)" }}>MASTER</span>}
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
                          <button className="btn" onClick={() => setWizardStep(1)}>Back</button>
                          <button className="btn btn-primary" onClick={() => setWizardStep(3)}>
                            Next Phase <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {wizardStep === 3 && (
                      <motion.div key="step3" variants={fadeUp} initial="hidden" animate="visible" exit="exit" style={{ display: "flex", gap: "24px", flex: 1, minHeight: 0 }}>
                        
                        <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                          <div className="card-header" style={{ padding: "16px 24px" }}>
                            <h3 className="card-title" style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 12 }}>
                              <MessageSquareTerminal size={16} color="var(--text-accent)" /> Session Terminal
                            </h3>
                          </div>
                          
                          <div className="card-body" style={{ padding: 0, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                            <div className="chat-container">
                              <div className="chat-history" style={{ border: "none", borderRadius: 0, margin: 0, flex: 1 }}>
                                {messages.length === 0 ? (
                                  <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                                    [ TERMINAL AWAITING DIRECTIVES ]
                                  </div>
                                ) : null}
                                {messages.map((m) => (
                                  <div key={m.id} className={`chat-bubble ${m.role}`}>
                                    <div className="bubble-role">{m.role === "assistant" ? "SYS.AGENT" : "OPERATOR"}</div>
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
                                    placeholder="Input directive..."
                                  />
                                  <button className="btn" disabled={loading || !sessionId}>Transmit</button>
                                </div>
                              </form>
                            </div>
                          </div>
                        </div>

                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
                          <div className="card" style={{ flexShrink: 0 }}>
                            <div className="card-body" style={{ padding: "24px" }}>
                              <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                                Synthesis Controls
                              </h4>
                              <textarea
                                className="text-input"
                                style={{ width: "100%", marginBottom: "16px" }}
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                rows="2"
                                placeholder="Global compilation directives..."
                              />
                              <div style={{ display: "flex", gap: "12px" }}>
                                <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={onGenerate} disabled={loading || !sessionId}>
                                  <Zap size={14} color="var(--text-accent)" /> Execute
                                </button>
                                <button
                                  className="btn btn-primary"
                                  style={{ flex: 1, justifyContent: "center" }}
                                  onClick={onMergeDownload}
                                  disabled={loading || !sessionId || !activeTemplateId}
                                >
                                  Compile & Download
                                </button>
                              </div>
                            </div>
                          </div>

                          {generation?.sections?.full_markdown && (
                            <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                              <div className="card-header" style={{ padding: "16px 24px" }}>
                                <h3 className="card-title" style={{ fontSize: 14 }}>Output Buffer</h3>
                              </div>
                              <div className="card-body" style={{ padding: 0, overflow: "auto" }}>
                                <div className="preview-box" style={{ border: "none", borderRadius: 0, minHeight: "100%" }}>
                                  {generation.sections.full_markdown}
                                </div>
                              </div>
                            </div>
                          )}
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
                        <Database color="var(--text-accent)" /> Storage: Context
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
                        <span style={{ fontSize: "14px", fontWeight: 700 }}>Drop Source Materials</span>
                        <input className="usa-file-input" style={{ display: "none" }} id="context-mgr" type="file" multiple onChange={onUploadContext} />
                        <label htmlFor="context-mgr" className="btn" style={{ marginTop: 12 }}>Browse</label>
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
                        <LayoutTemplate color="var(--text-accent)" /> Storage: Templates
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
                        <span style={{ fontSize: "14px", fontWeight: 700 }}>Drop DOCX Templates</span>
                        <input className="usa-file-input" style={{ display: "none" }} id="tpl-mgr" type="file" multiple onChange={onUploadTemplate} />
                        <label htmlFor="tpl-mgr" className="btn" style={{ marginTop: 12 }}>Browse</label>
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
              <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "16px", letterSpacing: "0.1em", margin: "0 0 8px 0" }}>SYSTEM STANDBY</h2>
              <p style={{ margin: 0, fontSize: "14px" }}>Initialize a workspace to engage parameters.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
