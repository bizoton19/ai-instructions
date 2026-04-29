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

  const Icon = ({ name, size = 3, className = "" }) => (
    <svg className={`usa-icon usa-icon--size-${size} ${className}`} aria-hidden="true" focusable="false" role="img">
      <use xlinkHref={`https://unpkg.com/@uswds/uswds@3.13.0/dist/img/sprite.svg#${name}`}></use>
    </svg>
  );

  return (
    <div className="app-container">
      <a className="usa-skipnav" href="#main-content">Skip to main content</a>

      {/* Official Government Banner */}
      <section className="usa-banner" aria-label="Official website of the United States government">
        <header className="usa-banner__header">
          <div className="usa-banner__inner">
            <div className="grid-col-auto">
              <img aria-hidden="true" className="usa-banner__header-flag" src="https://unpkg.com/@uswds/uswds@3.13.0/dist/img/us_flag_small.png" alt="" />
            </div>
            <div className="grid-col-fill tablet:grid-col-auto" aria-hidden="true">
              <p className="usa-banner__header-text">An official website of the United States government</p>
            </div>
          </div>
        </header>
      </section>

      {/* Federal Header */}
      <header className="federal-header" role="banner">
        <div className="display-flex flex-justify flex-align-center padding-y-2 padding-x-4">
          <div className="display-flex flex-align-center">
            <h1 className="margin-0 font-heading-lg text-white font-sans text-uppercase text-bold letter-spacing-2">
              Federal SOW Agent
            </h1>
          </div>
          <div className="display-flex flex-align-center gap-2">
            <Icon name="account_circle" size="4" />
            <span className="font-sans text-bold text-uppercase letter-spacing-1">Contracting Officer</span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main id="main-content">
        <div className="grid-row display-flex">
          
          {/* Left Rail (Workspaces) */}
          <aside className="grid-col-12 tablet:grid-col-4 desktop:grid-col-3 rail-container" aria-label="Workspace and session navigation">
            <div className="rail-header">
              <h2 className="margin-0 font-heading-md text-ink text-editorial">Workspaces</h2>
              <button 
                className="usa-button usa-button--unstyled text-ink display-flex flex-align-center" 
                onClick={onCreateWorkspace} 
                aria-label="New Workspace"
              >
                <Icon name="add" size="4" />
              </button>
            </div>
            
            <nav aria-label="Workspaces">
              {workspaces.map((ws) => (
                <div key={ws.id}>
                  <button 
                    className={`workspace-button ${workspaceId === ws.id ? "is-active" : ""}`}
                    onClick={() => setWorkspaceId(ws.id)}
                  >
                    <span>{ws.name}</span>
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
                    <div className="bg-paper padding-bottom-2">
                      {sessions.length === 0 ? (
                        <p className="margin-0 padding-2 text-italic font-sans text-base-dark">No sessions yet.</p>
                      ) : (
                        sessions.map((s) => (
                          <button 
                            key={s.id}
                            className={`session-button ${sessionId === s.id ? "is-active" : ""}`}
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
          <section className="grid-col-12 tablet:grid-col-8 desktop:grid-col-9 canvas-container" aria-label="Workspace canvas">
            {notice && (
              <div className="usa-alert usa-alert--info border-3 border-ink radius-0 shadow-none margin-bottom-4">
                <div className="usa-alert__body font-sans text-bold text-ink">{notice}</div>
              </div>
            )}

            {/* Toolbar */}
            <div className="display-flex flex-justify flex-align-start margin-bottom-4 border-bottom-3 border-ink padding-bottom-3">
              <div>
                <h2 className="margin-0 text-editorial font-heading-xl text-ink">
                  {activeWorkspace?.name || "Select a Workspace"}
                </h2>
                {activeWorkspace && (
                  <div className="margin-top-2">
                    <span className="stat-tag">Context: {contextDocs.length}</span>
                    <span className="stat-tag accent">Templates: {templates.length}</span>
                    <span className="stat-tag primary">Sessions: {sessions.length}</span>
                  </div>
                )}
              </div>
              {activeWorkspace && (
                <div className="display-flex gap-2">
                  <button
                    className={`usa-button ${viewMode === "wizard" ? "" : "usa-button--outline"}`}
                    onClick={() => setViewMode("wizard")}
                  >
                    Drafting Wizard
                  </button>
                  <button
                    className={`usa-button ${viewMode === "manager" ? "" : "usa-button--outline"}`}
                    onClick={() => setViewMode("manager")}
                  >
                    File Manager
                  </button>
                </div>
              )}
            </div>

            {viewMode === "wizard" && activeWorkspace ? (
              <div className="wizard-flow">
                {/* Stepper */}
                <div className="usa-step-indicator margin-bottom-5" aria-label="progress">
                  <ol className="usa-step-indicator__segments">
                    <li className={`usa-step-indicator__segment ${wizardStep === 0 ? "usa-step-indicator__segment--current" : wizardStep > 0 ? "usa-step-indicator__segment--complete" : ""}`}>
                      <span className="usa-step-indicator__segment-label">Start <span className="usa-sr-only">{wizardStep === 0 ? "not completed" : "completed"}</span></span>
                    </li>
                    <li className={`usa-step-indicator__segment ${wizardStep === 1 ? "usa-step-indicator__segment--current" : wizardStep > 1 ? "usa-step-indicator__segment--complete" : ""}`}>
                      <span className="usa-step-indicator__segment-label">Context <span className="usa-sr-only">{wizardStep === 1 ? "not completed" : wizardStep > 1 ? "completed" : ""}</span></span>
                    </li>
                    <li className={`usa-step-indicator__segment ${wizardStep === 2 ? "usa-step-indicator__segment--current" : wizardStep > 2 ? "usa-step-indicator__segment--complete" : ""}`}>
                      <span className="usa-step-indicator__segment-label">Template <span className="usa-sr-only">{wizardStep === 2 ? "not completed" : wizardStep > 2 ? "completed" : ""}</span></span>
                    </li>
                    <li className={`usa-step-indicator__segment ${wizardStep === 3 ? "usa-step-indicator__segment--current" : ""}`}>
                      <span className="usa-step-indicator__segment-label">Draft & Export <span className="usa-sr-only">{wizardStep === 3 ? "not completed" : ""}</span></span>
                    </li>
                  </ol>
                </div>

                {wizardStep === 0 && (
                  <div className="editorial-card">
                    <div className="editorial-card__header">
                      <h2>Welcome to the SOW Assembly Engine</h2>
                    </div>
                    <div className="editorial-card__body font-sans text-lg">
                      <p className="margin-top-0 text-bold text-ink">This engine compiles federal requirements into rigorous Statements of Work.</p>
                      <ul className="usa-list line-height-sans-5 text-ink margin-top-3">
                        <li><strong>1. Provide Material:</strong> Supply raw documents, schedules, or spreadsheets.</li>
                        <li><strong>2. Define Structure:</strong> Upload a boilerplate agency template.</li>
                        <li><strong>3. Execute:</strong> Instruct the AI agent to draft and refine the text.</li>
                        <li><strong>4. Compile:</strong> Download the perfectly formatted document.</li>
                      </ul>
                    </div>
                    <div className="editorial-card__footer">
                      <button className="usa-button" onClick={nextStep}>Commence Process <Icon name="arrow_forward" size="3" className="margin-left-1" /></button>
                    </div>
                  </div>
                )}

                {wizardStep === 1 && (
                  <div className="editorial-card">
                    <div className="editorial-card__header">
                      <h2>Phase 1: Knowledge Ingestion</h2>
                    </div>
                    <div className="editorial-card__body">
                      <p className="font-sans margin-top-0 text-ink text-bold">Provide raw materials (PDFs, Docs, spreadsheets) the agent will study.</p>
                      
                      <div
                        className="dropzone-editorial margin-y-4"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          uploadManyContext(Array.from(e.dataTransfer.files || []));
                        }}
                      >
                        <Icon name="file_upload" size="7" className="margin-bottom-2 text-primary" />
                        <div className="text-bold">Drag and drop raw context documents</div>
                        <div className="font-sans text-base margin-top-1 text-base-dark">or click to browse local files</div>
                        <input className="usa-file-input display-none" id="context-file" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.md,.txt,image/*" onChange={onUploadContext} />
                        <label htmlFor="context-file" className="usa-button margin-top-3">Select Files</label>
                      </div>
                      
                      {contextDocs.length > 0 && (
                        <div className="border-top-3 border-ink padding-top-3">
                          <h3 className="font-heading-sm text-editorial margin-top-0">Ingested Files:</h3>
                          <ul className="usa-list usa-list--unstyled">
                            {contextDocs.map((d) => (
                              <li key={d.id} className="file-list-item">
                                <Icon name="description" size="4" className="margin-right-2 text-primary" />
                                <span className="font-sans text-bold text-ink flex-fill">{d.filename}</span>
                                <span className="stat-tag bg-base-light text-ink">{d.kind}</span>
                                <button className="usa-button usa-button--unstyled text-secondary hover:text-secondary-dark margin-left-2" onClick={() => onDeleteContext(d.id)} aria-label="Remove file">
                                  <Icon name="delete" size="3" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="editorial-card__footer">
                      <button className="usa-button usa-button--outline" onClick={prevStep}>Previous</button>
                      <button className="usa-button" onClick={nextStep}>Advance <Icon name="arrow_forward" size="3" className="margin-left-1" /></button>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="editorial-card">
                    <div className="editorial-card__header">
                      <h2>Phase 2: Template Designation</h2>
                    </div>
                    <div className="editorial-card__body">
                      <p className="font-sans margin-top-0 text-ink text-bold">Upload boilerplate templates (.docx) and designate the master target format.</p>
                      
                      <div
                        className="dropzone-editorial margin-y-4"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          uploadManyTemplates(Array.from(e.dataTransfer.files || []));
                        }}
                      >
                        <Icon name="file_upload" size="7" className="margin-bottom-2 text-accent" />
                        <div className="text-bold">Drag and drop agency template files</div>
                        <div className="font-sans text-base margin-top-1 text-base-dark">or click to browse local files</div>
                        <input className="usa-file-input display-none" id="template-file" type="file" multiple accept=".docx" onChange={onUploadTemplate} />
                        <label htmlFor="template-file" className="usa-button usa-button--accent-warm margin-top-3 text-ink">Select Templates</label>
                      </div>
                      
                      {templates.length > 0 && (
                        <div className="border-top-3 border-ink padding-top-3">
                          <h3 className="font-heading-sm text-editorial margin-top-0">Available Templates:</h3>
                          <ul className="usa-list usa-list--unstyled">
                            {templates.map((t) => (
                              <li key={t.id} className="file-list-item">
                                <div className="usa-radio">
                                  <input
                                    className="usa-radio__input"
                                    type="radio"
                                    name="active-template"
                                    id={`tpl-${t.id}`}
                                    checked={activeTemplateId === t.id}
                                    onChange={() => onActivateTemplate(t.id)}
                                  />
                                  <label className="usa-radio__label font-sans text-bold text-ink margin-top-0" htmlFor={`tpl-${t.id}`}>
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
                    <div className="editorial-card__footer">
                      <button className="usa-button usa-button--outline" onClick={prevStep}>Previous</button>
                      <button className="usa-button" onClick={nextStep}>Advance <Icon name="arrow_forward" size="3" className="margin-left-1" /></button>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <>
                    <div className="editorial-card">
                      <div className="editorial-card__header">
                        <h2>Phase 3: Generation Protocol</h2>
                      </div>
                      <div className="editorial-card__body padding-x-0">
                        {/* Chat Interface */}
                        <div className="editorial-chat margin-x-2">
                          {messages.length === 0 ? (
                            <div className="padding-4 text-center">
                              <Icon name="info" size="5" className="text-base-dark margin-bottom-2" />
                              <p className="font-sans text-bold text-ink">No communication logged. Input directives below to commence.</p>
                            </div>
                          ) : null}
                          {messages.map((m) => (
                            <div key={m.id} className={`chat-bubble ${m.role}`}>
                              <div className="chat-bubble__name">{m.role === "assistant" ? "System Agent" : "Contracting Officer"}</div>
                              <div className="chat-bubble__text">{m.content}</div>
                            </div>
                          ))}
                        </div>
                        
                        <form className="padding-x-3" onSubmit={onSendMessage}>
                          <label className="usa-label text-bold font-sans text-uppercase letter-spacing-1" htmlFor="chat-message">Add Session Directive</label>
                          <div className="display-flex flex-align-end gap-2 margin-top-1">
                            <textarea
                              className="usa-textarea flex-fill"
                              id="chat-message"
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              rows="2"
                              placeholder="E.g., Focus specifically on the hardware requirements..."
                            />
                            <button className="usa-button margin-bottom-0 padding-y-2" disabled={loading || !sessionId}>Transmit</button>
                          </div>
                        </form>
                        
                        <div className="border-top-3 border-ink margin-top-4 padding-top-3 padding-x-3">
                          <label className="usa-label text-bold font-sans text-uppercase letter-spacing-1" htmlFor="extra-instructions">
                            Final Compile Instructions
                          </label>
                          <textarea
                            className="usa-textarea width-full margin-top-1"
                            id="extra-instructions"
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            rows="2"
                            placeholder="Final adjustments before writing..."
                          />
                          
                          <div className="margin-top-4 display-flex gap-3">
                            <button className="usa-button padding-y-2 flex-1" onClick={onGenerate} disabled={loading || !sessionId}>
                              Generate SOW Draft
                            </button>
                            <button
                              className="usa-button padding-y-2 flex-1"
                              style={{ backgroundColor: "var(--federal-accent)", color: "var(--federal-ink)" }}
                              onClick={onMergeDownload}
                              disabled={loading || !sessionId || !activeTemplateId}
                            >
                              Compile & Download Word .DOCX
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="editorial-card__footer">
                        <button className="usa-button usa-button--outline" onClick={prevStep}>Previous</button>
                      </div>
                    </div>
                    
                    {generation?.sections?.full_markdown && (
                      <div className="margin-top-5">
                        <h2 className="text-editorial font-heading-xl text-ink margin-bottom-3">Generated Output</h2>
                        <div className="preview-box">
                          {generation.sections.full_markdown}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : viewMode === "manager" && activeWorkspace ? (
              <div className="manager-view">
                <div className="editorial-card">
                  <div className="editorial-card__header">
                    <h2>Context Knowledge Base</h2>
                  </div>
                  <div className="editorial-card__body">
                    <div
                      className="dropzone-editorial margin-bottom-4 padding-y-3"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        uploadManyContext(Array.from(e.dataTransfer.files || []));
                      }}
                    >
                      <Icon name="file_upload" size="5" className="margin-bottom-1 text-primary" />
                      <div className="text-bold">Add context file</div>
                      <input className="usa-file-input display-none" id="context-file-mgr" type="file" multiple onChange={onUploadContext} />
                      <label htmlFor="context-file-mgr" className="usa-button margin-top-2">Browse</label>
                    </div>
                    {contextDocs.length > 0 ? (
                      <ul className="usa-list usa-list--unstyled">
                        {contextDocs.map((d) => (
                          <li key={d.id} className="file-list-item">
                            <Icon name="description" size="4" className="margin-right-2 text-primary" />
                            <span className="font-sans text-bold flex-fill">{d.filename}</span>
                            <span className="stat-tag bg-base-light text-ink">{d.kind}</span>
                            <button className="usa-button usa-button--unstyled text-secondary margin-left-2" onClick={() => onDeleteContext(d.id)}>
                              <Icon name="delete" size="3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="font-sans text-italic">No knowledge base documents.</p>}
                  </div>
                </div>

                <div className="editorial-card">
                  <div className="editorial-card__header">
                    <h2>Template Repository</h2>
                  </div>
                  <div className="editorial-card__body">
                    <div
                      className="dropzone-editorial margin-bottom-4 padding-y-3"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        uploadManyTemplates(Array.from(e.dataTransfer.files || []));
                      }}
                    >
                      <Icon name="file_upload" size="5" className="margin-bottom-1 text-accent" />
                      <div className="text-bold">Add template file (.docx)</div>
                      <input className="usa-file-input display-none" id="template-file-mgr" type="file" multiple accept=".docx" onChange={onUploadTemplate} />
                      <label htmlFor="template-file-mgr" className="usa-button usa-button--accent-warm margin-top-2 text-ink">Browse</label>
                    </div>
                    {templates.length > 0 ? (
                      <ul className="usa-list usa-list--unstyled">
                        {templates.map((t) => (
                          <li key={t.id} className={`file-list-item ${activeTemplateId === t.id ? 'bg-primary-lightest padding-x-2' : ''}`}>
                            <div className="usa-radio">
                              <input
                                className="usa-radio__input"
                                type="radio"
                                name="active-template-manager"
                                id={`tpl-mgr-${t.id}`}
                                checked={activeTemplateId === t.id}
                                onChange={() => onActivateTemplate(t.id)}
                              />
                              <label className="usa-radio__label font-sans text-bold text-ink margin-top-0" htmlFor={`tpl-mgr-${t.id}`}>
                                {t.filename}
                                {activeTemplateId === t.id && <span className="stat-tag accent margin-left-2">Master</span>}
                              </label>
                            </div>
                            <button className="usa-button usa-button--unstyled text-secondary margin-left-auto" onClick={() => onDeleteTemplate(t.id)}>
                              <Icon name="delete" size="3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="font-sans text-italic">No templates in repository.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="padding-5 text-center text-base-dark">
                <Icon name="folder" size="9" className="margin-bottom-3 opacity-50" />
                <h2 className="text-editorial font-heading-xl text-ink margin-top-0">Awaiting Workspace Designation</h2>
                <p className="font-sans text-lg">Select a workspace from the left rail or create a new one to begin operations.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Official USWDS Footer */}
      <footer className="usa-footer usa-footer--slim" role="contentinfo">
        <div className="grid-container usa-footer__return-to-top">
          <a href="#">Return to top</a>
        </div>
        <div className="usa-footer__primary-section bg-federal-ink">
          <div className="usa-footer__primary-container grid-row">
            <div className="mobile-lg:grid-col-8">
              <nav className="usa-footer__nav" aria-label="Footer navigation">
                <ul className="grid-row grid-gap">
                  <li className="mobile-lg:grid-col-6 desktop:grid-col-auto usa-footer__primary-content">
                    <a className="usa-footer__primary-link text-white" href="#">Privacy Policy</a>
                  </li>
                  <li className="mobile-lg:grid-col-6 desktop:grid-col-auto usa-footer__primary-content">
                    <a className="usa-footer__primary-link text-white" href="#">Accessibility Statement</a>
                  </li>
                  <li className="mobile-lg:grid-col-6 desktop:grid-col-auto usa-footer__primary-content">
                    <a className="usa-footer__primary-link text-white" href="#">Vulnerability Disclosure Policy</a>
                  </li>
                  <li className="mobile-lg:grid-col-6 desktop:grid-col-auto usa-footer__primary-content">
                    <a className="usa-footer__primary-link text-white" href="#">FOIA</a>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="mobile-lg:grid-col-4">
              <address className="usa-footer__address">
                <div className="usa-footer__contact-info">
                  <div className="text-white margin-top-1">
                    System generated drafting portal.<br/>Not for final distribution without human review.
                  </div>
                </div>
              </address>
            </div>
          </div>
        </div>
      </footer>

      {/* Federal Identifier */}
      <div className="usa-identifier">
        <section className="usa-identifier__section usa-identifier__section--masthead" aria-label="Agency identifier">
          <div className="usa-identifier__container">
            <div className="usa-identifier__logos">
              <a href="#" className="usa-identifier__logo">
                <img className="usa-identifier__logo-img" src="https://unpkg.com/@uswds/uswds@3.13.0/dist/img/circle-gray-20.svg" alt="Agency logo" role="img" />
              </a>
            </div>
            <div className="usa-identifier__identity" aria-label="Agency description">
              <p className="usa-identifier__identity-domain">federal-sow-agent.gov</p>
              <p className="usa-identifier__identity-disclaimer">An official website of the <a href="#">U.S. Government</a></p>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}

export default App;
