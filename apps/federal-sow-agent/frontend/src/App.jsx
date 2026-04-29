import { useEffect, useMemo, useState } from "react";
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
    refreshWorkspaceData(workspaceId).catch((e) => setNotice(e.message));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !sessionId) return;
    api
      .listMessages(workspaceId, sessionId)
      .then(setMessages)
      .catch((e) => setNotice(e.message));
  }, [workspaceId, sessionId]);

  async function onCreateWorkspace() {
    const name = prompt("Workspace name") || "Default Workspace";
    if (!name) return;
    try {
      const ws = await api.createWorkspace(name);
      await loadWorkspaces();
      setWorkspaceId(ws.id);
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function onCreateSession() {
    if (!workspaceId) return;
    try {
      const s = await api.createSession(workspaceId, "New SOW Session");
      const next = await api.listSessions(workspaceId);
      setSessions(next);
      setSessionId(s.id);
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function uploadManyContext(files) {
    if (!files?.length || !workspaceId) return;
    setLoading(true);
    try {
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        await api.uploadContext(workspaceId, file);
      }
      await refreshWorkspaceData(workspaceId);
      setNotice(`Uploaded ${files.length} context file(s).`);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadManyTemplates(files) {
    if (!files?.length || !workspaceId) return;
    setLoading(true);
    try {
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        await api.uploadTemplate(workspaceId, file);
      }
      await refreshWorkspaceData(workspaceId);
      setNotice(`Uploaded ${files.length} template file(s).`);
    } catch (err) {
      setNotice(err.message);
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
    setNotice("Active template updated.");
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
      setNotice("Generated SOW draft.");
    } catch (err) {
      setNotice(err.message);
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
      setNotice("Merged document is ready for download.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    setWizardStep((prev) => Math.min(prev + 1, 3));
  }

  function prevStep() {
    setWizardStep((prev) => Math.max(prev - 1, 0));
  }

  // Load icons from the local sprite downloaded to public/assets/img/sprite.svg
  const Icon = ({ name, size = 3, className = "" }) => (
    <svg className={`usa-icon usa-icon--size-${size} ${className}`} aria-hidden="true" focusable="false" role="img">
      <use xlinkHref={`/assets/img/sprite.svg#${name}`}></use>
    </svg>
  );

  return (
    <div className="app-container">
      <a className="usa-skipnav" href="#main-content">Skip to main content</a>

      {/* Official Government Banner - Compact */}
      <section className="usa-banner usa-banner--slim" aria-label="Official website of the United States government">
        <header className="usa-banner__header padding-y-05">
          <div className="usa-banner__inner">
            <div className="grid-col-auto">
              <img aria-hidden="true" className="usa-banner__header-flag width-2" src="https://unpkg.com/@uswds/uswds@3.13.0/dist/img/us_flag_small.png" alt="" />
            </div>
            <div className="grid-col-fill tablet:grid-col-auto margin-left-1" aria-hidden="true">
              <p className="usa-banner__header-text text-sm">An official website of the United States government</p>
            </div>
          </div>
        </header>
      </section>

      {/* Federal Header - Compact */}
      <header className="federal-header" role="banner">
        <div className="display-flex flex-justify flex-align-center padding-y-1 padding-x-4">
          <div className="display-flex flex-align-center">
            <h1 className="margin-0 font-heading-md text-white font-sans text-uppercase text-bold letter-spacing-1">
              Federal SOW Agent
            </h1>
          </div>
          <div className="display-flex flex-align-center gap-1">
            <Icon name="account_circle" size="3" />
            <span className="font-sans text-bold text-uppercase letter-spacing-1 text-sm">Contracting Officer</span>
          </div>
        </div>
      </header>

      {/* Main Layout - Height fills remaining viewport */}
      <main id="main-content" className="main-content-layout">
        
        {/* Left Rail (Workspaces) */}
        <aside className="rail-container" aria-label="Workspace and session navigation">
          <div className="rail-header">
            <h2 className="margin-0 font-heading-sm text-ink text-editorial">Workspaces</h2>
            <button 
              className="usa-button usa-button--unstyled text-ink display-flex flex-align-center" 
              onClick={onCreateWorkspace} 
              aria-label="New Workspace"
            >
              <Icon name="add" size="3" />
            </button>
          </div>
          
          <nav aria-label="Workspaces" className="rail-nav">
            {workspaces.map((ws) => (
              <div key={ws.id}>
                <button 
                  className={`workspace-button ${workspaceId === ws.id ? "is-active" : ""}`}
                  onClick={() => setWorkspaceId(ws.id)}
                >
                  <span className="text-sm">{ws.name}</span>
                  {workspaceId === ws.id && (
                    <span 
                      className="display-flex flex-align-center" 
                      onClick={(e) => { e.stopPropagation(); onCreateSession(); }}
                      title="New Session"
                      aria-label="New Session"
                    >
                      <Icon name="add" size="3" className="text-white" />
                    </span>
                  )}
                </button>
                
                {workspaceId === ws.id && (
                  <div className="bg-paper padding-bottom-1">
                    {sessions.length === 0 ? (
                      <p className="margin-0 padding-1 text-italic font-sans text-xs text-base-dark">No sessions yet.</p>
                    ) : (
                      sessions.map((s) => (
                        <button 
                          key={s.id}
                          className={`session-button text-xs ${sessionId === s.id ? "is-active" : ""}`}
                          onClick={() => setSessionId(s.id)}
                        >
                          {s.title}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Canvas */}
        <section className="canvas-container flex-fill" aria-label="Workspace canvas">
          {notice && (
            <div className="usa-alert usa-alert--info usa-alert--slim border-3 border-ink radius-0 shadow-none margin-bottom-2">
              <div className="usa-alert__body font-sans text-bold text-ink text-sm">{notice}</div>
            </div>
          )}

          {/* Toolbar */}
          <div className="display-flex flex-justify flex-align-start margin-bottom-2 border-bottom-3 border-ink padding-bottom-2">
            <div>
              <h2 className="margin-0 text-editorial font-heading-lg text-ink">
                {activeWorkspace?.name || "Select a Workspace"}
              </h2>
              {activeWorkspace && (
                <div className="margin-top-1">
                  <span className="stat-tag">Context: {contextDocs.length}</span>
                  <span className="stat-tag accent">Templates: {templates.length}</span>
                  <span className="stat-tag primary">Sessions: {sessions.length}</span>
                </div>
              )}
            </div>
            {activeWorkspace && (
              <div className="display-flex gap-1">
                <button
                  className={`usa-button padding-y-1 ${viewMode === "wizard" ? "" : "usa-button--outline"}`}
                  onClick={() => setViewMode("wizard")}
                >
                  Wizard
                </button>
                <button
                  className={`usa-button padding-y-1 ${viewMode === "manager" ? "" : "usa-button--outline"}`}
                  onClick={() => setViewMode("manager")}
                >
                  Files
                </button>
              </div>
            )}
          </div>

          {viewMode === "wizard" && activeWorkspace ? (
            <div className="wizard-flow">
              {/* Compact Stepper */}
              <div className="usa-step-indicator usa-step-indicator--counters-sm margin-bottom-3" aria-label="progress">
                <ol className="usa-step-indicator__segments">
                  <li className={`usa-step-indicator__segment ${wizardStep === 0 ? "usa-step-indicator__segment--current" : wizardStep > 0 ? "usa-step-indicator__segment--complete" : ""}`}>
                    <span className="usa-step-indicator__segment-label">Start</span>
                  </li>
                  <li className={`usa-step-indicator__segment ${wizardStep === 1 ? "usa-step-indicator__segment--current" : wizardStep > 1 ? "usa-step-indicator__segment--complete" : ""}`}>
                    <span className="usa-step-indicator__segment-label">Context</span>
                  </li>
                  <li className={`usa-step-indicator__segment ${wizardStep === 2 ? "usa-step-indicator__segment--current" : wizardStep > 2 ? "usa-step-indicator__segment--complete" : ""}`}>
                    <span className="usa-step-indicator__segment-label">Template</span>
                  </li>
                  <li className={`usa-step-indicator__segment ${wizardStep === 3 ? "usa-step-indicator__segment--current" : ""}`}>
                    <span className="usa-step-indicator__segment-label">Draft & Export</span>
                  </li>
                </ol>
              </div>

              {wizardStep === 0 && (
                <div className="editorial-card">
                  <div className="editorial-card__header padding-y-1">
                    <h2 className="font-heading-md">Assembly Engine</h2>
                  </div>
                  <div className="editorial-card__body padding-y-2 text-sm">
                    <p className="margin-top-0 text-bold text-ink">This engine compiles federal requirements into rigorous Statements of Work.</p>
                    <ul className="usa-list text-ink margin-top-2">
                      <li><strong>1. Material:</strong> Supply raw documents.</li>
                      <li><strong>2. Structure:</strong> Upload a boilerplate agency template.</li>
                      <li><strong>3. Execute:</strong> Instruct the AI agent to draft and refine the text.</li>
                      <li><strong>4. Compile:</strong> Download the perfectly formatted document.</li>
                    </ul>
                  </div>
                  <div className="editorial-card__footer padding-y-1">
                    <button className="usa-button padding-y-1" onClick={nextStep}>Commence <Icon name="arrow_forward" size="3" className="margin-left-1" /></button>
                  </div>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="editorial-card">
                  <div className="editorial-card__header padding-y-1">
                    <h2 className="font-heading-md">Phase 1: Knowledge</h2>
                  </div>
                  <div className="editorial-card__body padding-y-2 text-sm">
                    
                    <div
                      className="dropzone-editorial padding-y-2 margin-bottom-2"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        uploadManyContext(Array.from(e.dataTransfer.files || []));
                      }}
                    >
                      <div className="display-flex flex-align-center flex-justify-center gap-1">
                        <Icon name="file_upload" size="4" className="text-primary" />
                        <div className="text-bold text-base">Drag & drop raw documents</div>
                      </div>
                      <input className="usa-file-input display-none" id="context-file" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.md,.txt,image/*" onChange={onUploadContext} />
                      <label htmlFor="context-file" className="usa-button usa-button--outline margin-top-1 padding-y-1">Browse Files</label>
                    </div>
                    
                    {contextDocs.length > 0 && (
                      <div className="border-top-3 border-ink padding-top-1">
                        <ul className="usa-list usa-list--unstyled file-list-compact">
                          {contextDocs.map((d) => (
                            <li key={d.id} className="file-list-item padding-y-05">
                              <Icon name="description" size="3" className="margin-right-1 text-primary" />
                              <span className="font-sans text-bold text-ink flex-fill text-xs">{d.filename}</span>
                              <span className="stat-tag bg-base-light text-ink text-xs">{d.kind}</span>
                              <button className="usa-button usa-button--unstyled text-secondary hover:text-secondary-dark margin-left-1" onClick={() => onDeleteContext(d.id)} aria-label="Remove file">
                                <Icon name="delete" size="3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="editorial-card__footer padding-y-1">
                    <button className="usa-button usa-button--outline padding-y-1" onClick={prevStep}>Prev</button>
                    <button className="usa-button padding-y-1" onClick={nextStep}>Next <Icon name="arrow_forward" size="3" className="margin-left-1" /></button>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="editorial-card">
                  <div className="editorial-card__header padding-y-1">
                    <h2 className="font-heading-md">Phase 2: Templates</h2>
                  </div>
                  <div className="editorial-card__body padding-y-2 text-sm">
                    
                    <div
                      className="dropzone-editorial padding-y-2 margin-bottom-2"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        uploadManyTemplates(Array.from(e.dataTransfer.files || []));
                      }}
                    >
                      <div className="display-flex flex-align-center flex-justify-center gap-1">
                        <Icon name="file_upload" size="4" className="text-accent" />
                        <div className="text-bold text-base">Drag & drop .docx templates</div>
                      </div>
                      <input className="usa-file-input display-none" id="template-file" type="file" multiple accept=".docx" onChange={onUploadTemplate} />
                      <label htmlFor="template-file" className="usa-button usa-button--accent-warm margin-top-1 padding-y-1 text-ink">Browse Templates</label>
                    </div>
                    
                    {templates.length > 0 && (
                      <div className="border-top-3 border-ink padding-top-1">
                        <ul className="usa-list usa-list--unstyled file-list-compact">
                          {templates.map((t) => (
                            <li key={t.id} className="file-list-item padding-y-05">
                              <div className="usa-radio">
                                <input
                                  className="usa-radio__input"
                                  type="radio"
                                  name="active-template"
                                  id={`tpl-${t.id}`}
                                  checked={activeTemplateId === t.id}
                                  onChange={() => onActivateTemplate(t.id)}
                                />
                                <label className="usa-radio__label font-sans text-bold text-ink margin-top-0 text-xs" htmlFor={`tpl-${t.id}`}>
                                  {t.filename}
                                </label>
                              </div>
                              <button className="usa-button usa-button--unstyled text-secondary margin-left-auto" onClick={() => onDeleteTemplate(t.id)}>
                                <Icon name="delete" size="3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="editorial-card__footer padding-y-1">
                    <button className="usa-button usa-button--outline padding-y-1" onClick={prevStep}>Prev</button>
                    <button className="usa-button padding-y-1" onClick={nextStep}>Next <Icon name="arrow_forward" size="3" className="margin-left-1" /></button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="display-flex gap-2 full-height-wizard">
                  <div className="editorial-card flex-fill margin-bottom-0 display-flex flex-column">
                    <div className="editorial-card__header padding-y-1">
                      <h2 className="font-heading-md">Phase 3: Generation</h2>
                    </div>
                    <div className="editorial-card__body padding-x-0 padding-y-0 display-flex flex-column flex-fill" style={{overflow: 'hidden'}}>
                      {/* Chat Interface */}
                      <div className="editorial-chat margin-2 flex-fill">
                        {messages.length === 0 ? (
                          <div className="padding-2 text-center">
                            <Icon name="info" size="4" className="text-base-dark margin-bottom-1" />
                            <p className="font-sans text-bold text-ink text-sm">Input directives below.</p>
                          </div>
                        ) : null}
                        {messages.map((m) => (
                          <div key={m.id} className={`chat-bubble padding-1 ${m.role}`}>
                            <div className="chat-bubble__name text-xs">{m.role === "assistant" ? "System" : "Officer"}</div>
                            <div className="chat-bubble__text text-sm">{m.content}</div>
                          </div>
                        ))}
                      </div>
                      
                      <form className="padding-x-2 margin-bottom-2" onSubmit={onSendMessage}>
                        <div className="display-flex flex-align-end gap-1">
                          <textarea
                            className="usa-textarea flex-fill text-sm padding-1"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            rows="2"
                            placeholder="Directives..."
                          />
                          <button className="usa-button margin-bottom-0 padding-y-1" disabled={loading || !sessionId}>Send</button>
                        </div>
                      </form>
                      
                      <div className="border-top-3 border-ink padding-2 bg-paper">
                        <textarea
                          className="usa-textarea width-full text-sm padding-1"
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          rows="2"
                          placeholder="Final compilation instructions..."
                        />
                        
                        <div className="margin-top-1 display-flex gap-1">
                          <button className="usa-button padding-y-1 flex-1 text-xs" onClick={onGenerate} disabled={loading || !sessionId}>
                            Generate
                          </button>
                          <button
                            className="usa-button padding-y-1 flex-1 text-xs"
                            style={{ backgroundColor: "var(--federal-accent)", color: "var(--federal-ink)" }}
                            onClick={onMergeDownload}
                            disabled={loading || !sessionId || !activeTemplateId}
                          >
                            Download .DOCX
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {generation?.sections?.full_markdown && (
                    <div className="flex-fill display-flex flex-column" style={{maxHeight: '100%', overflow: 'hidden'}}>
                      <h2 className="text-editorial font-heading-md text-ink margin-top-0 margin-bottom-1">Output</h2>
                      <div className="preview-box flex-fill text-xs padding-2" style={{overflowY: 'auto'}}>
                        {generation.sections.full_markdown}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : viewMode === "manager" && activeWorkspace ? (
            <div className="manager-view display-flex gap-2">
              <div className="editorial-card flex-fill">
                <div className="editorial-card__header padding-y-1">
                  <h2 className="font-heading-md">Knowledge Base</h2>
                </div>
                <div className="editorial-card__body padding-2">
                  <div
                    className="dropzone-editorial padding-y-2 margin-bottom-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      uploadManyContext(Array.from(e.dataTransfer.files || []));
                    }}
                  >
                    <div className="display-flex flex-align-center flex-justify-center gap-1">
                      <Icon name="file_upload" size="4" className="text-primary" />
                      <div className="text-bold text-sm">Add context</div>
                    </div>
                    <input className="usa-file-input display-none" id="context-file-mgr" type="file" multiple onChange={onUploadContext} />
                    <label htmlFor="context-file-mgr" className="usa-button margin-top-1 padding-y-1 text-xs">Browse</label>
                  </div>
                  {contextDocs.length > 0 ? (
                    <ul className="usa-list usa-list--unstyled file-list-compact">
                      {contextDocs.map((d) => (
                        <li key={d.id} className="file-list-item padding-y-05">
                          <Icon name="description" size="3" className="margin-right-1 text-primary" />
                          <span className="font-sans text-bold flex-fill text-xs">{d.filename}</span>
                          <button className="usa-button usa-button--unstyled text-secondary margin-left-1" onClick={() => onDeleteContext(d.id)}>
                            <Icon name="delete" size="3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="font-sans text-italic text-sm">No documents.</p>}
                </div>
              </div>

              <div className="editorial-card flex-fill">
                <div className="editorial-card__header padding-y-1">
                  <h2 className="font-heading-md">Templates</h2>
                </div>
                <div className="editorial-card__body padding-2">
                  <div
                    className="dropzone-editorial padding-y-2 margin-bottom-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      uploadManyTemplates(Array.from(e.dataTransfer.files || []));
                    }}
                  >
                    <div className="display-flex flex-align-center flex-justify-center gap-1">
                      <Icon name="file_upload" size="4" className="text-accent" />
                      <div className="text-bold text-sm">Add .docx</div>
                    </div>
                    <input className="usa-file-input display-none" id="template-file-mgr" type="file" multiple accept=".docx" onChange={onUploadTemplate} />
                    <label htmlFor="template-file-mgr" className="usa-button usa-button--accent-warm margin-top-1 padding-y-1 text-ink text-xs">Browse</label>
                  </div>
                  {templates.length > 0 ? (
                    <ul className="usa-list usa-list--unstyled file-list-compact">
                      {templates.map((t) => (
                        <li key={t.id} className={`file-list-item padding-y-05 ${activeTemplateId === t.id ? 'bg-primary-lightest padding-x-1' : ''}`}>
                          <div className="usa-radio">
                            <input
                              className="usa-radio__input"
                              type="radio"
                              name="active-template-manager"
                              id={`tpl-mgr-${t.id}`}
                              checked={activeTemplateId === t.id}
                              onChange={() => onActivateTemplate(t.id)}
                            />
                            <label className="usa-radio__label font-sans text-bold text-ink margin-top-0 text-xs" htmlFor={`tpl-mgr-${t.id}`}>
                              {t.filename}
                            </label>
                          </div>
                          <button className="usa-button usa-button--unstyled text-secondary margin-left-auto" onClick={() => onDeleteTemplate(t.id)}>
                            <Icon name="delete" size="3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="font-sans text-italic text-sm">No templates.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="padding-3 text-center text-base-dark">
              <Icon name="folder" size="8" className="margin-bottom-2 opacity-50" />
              <h2 className="text-editorial font-heading-lg text-ink margin-top-0">Awaiting Workspace Designation</h2>
              <p className="font-sans text-sm">Select a workspace from the left rail or create a new one to begin operations.</p>
            </div>
          )}
        </section>
      </main>

      {/* Official USWDS Footer - Compact */}
      <footer className="usa-footer usa-footer--slim" role="contentinfo">
        <div className="usa-footer__primary-section bg-federal-ink padding-y-1">
          <div className="usa-footer__primary-container grid-row display-flex flex-align-center flex-justify">
            <nav className="usa-footer__nav" aria-label="Footer navigation">
              <ul className="display-flex gap-3 margin-0 padding-0 list-none">
                <li><a className="text-white text-xs text-no-underline hover:text-underline" href="#">Privacy Policy</a></li>
                <li><a className="text-white text-xs text-no-underline hover:text-underline" href="#">Accessibility</a></li>
                <li><a className="text-white text-xs text-no-underline hover:text-underline" href="#">FOIA</a></li>
              </ul>
            </nav>
            <div className="text-white text-xs text-right">
              Generated drafting portal. Not for distribution.
            </div>
          </div>
        </div>
      </footer>

      {/* Federal Identifier - Hidden to save space on strict 100vh requirement, logic moved to footer/banner */}
    </div>
  );
}

export default App;
