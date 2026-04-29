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

  return (
    <div className="app-container">
      {/* Slim Header */}
      <header className="slim-header" role="banner">
        <div className="slim-header-brand">
          <img src="https://unpkg.com/@uswds/uswds@3.13.0/dist/img/us_flag_small.png" alt="US Flag" className="slim-header-flag" />
          <h1 className="margin-0 font-heading-sm">Federal SOW Writer Agent</h1>
        </div>
        <div className="slim-header-user">
          <div className="avatar-placeholder" aria-label="User avatar">
            <svg className="usa-icon" aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
            </svg>
          </div>
        </div>
      </header>

      {/* Main Workspace Shell */}
      <main className="workspace-shell" id="main-content">
        {/* Left Rail */}
        <aside className="workspace-rail" aria-label="Workspace and session navigation">
          <div className="display-flex flex-justify flex-align-center margin-bottom-2 padding-bottom-1 border-bottom border-base-lighter">
            <h2 className="margin-0 font-heading-xs text-uppercase text-base">Workspaces</h2>
            <button className="usa-button usa-button--unstyled text-primary text-bold font-sans-lg" onClick={onCreateWorkspace} title="New Workspace" aria-label="New Workspace">
              +
            </button>
          </div>
          
          <ul className="usa-list usa-list--unstyled panel-list">
            {workspaces.map((ws) => (
              <li key={ws.id} className="margin-bottom-2">
                <div className={`workspace-item ${workspaceId === ws.id ? "is-active" : ""}`}>
                  <button 
                    className="usa-button usa-button--unstyled workspace-item-btn flex-fill text-left padding-1" 
                    onClick={() => setWorkspaceId(ws.id)}
                  >
                    <span className="text-bold font-sans-md text-primary-darker">{ws.name}</span>
                  </button>
                  {workspaceId === ws.id && (
                    <button 
                      className="usa-button usa-button--unstyled new-session-btn text-bold font-sans-lg padding-x-1" 
                      onClick={onCreateSession} 
                      title="New Session"
                      aria-label="New Session"
                    >
                      +
                    </button>
                  )}
                </div>
                
                {workspaceId === ws.id && (
                  <ul className="usa-list usa-list--unstyled session-list margin-top-05">
                    {sessions.length === 0 ? (
                      <li className="text-italic text-base-light padding-left-2 font-sans-xs">No sessions yet.</li>
                    ) : (
                      sessions.map((s) => (
                        <li key={s.id}>
                          <button 
                            className={`usa-button usa-button--unstyled width-full text-left padding-y-05 padding-left-2 session-item-btn ${sessionId === s.id ? "session-active" : "text-base"}`} 
                            onClick={() => setSessionId(s.id)}
                          >
                            <span className="text-sm">{s.title}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Canvas Area */}
        <section className="workspace-canvas" aria-label="Workspace canvas">
          {notice && (
            <div className="usa-alert usa-alert--info usa-alert--slim margin-bottom-3">
              <div className="usa-alert__body">{notice}</div>
            </div>
          )}
          
          <div className="workspace-toolbar">
            <div>
              <h2 className="margin-0">{activeWorkspace?.name || "Default workspace"}</h2>
              <p className="margin-y-05 text-sm text-italic">
                <span className="usa-tag radius-md margin-right-1 bg-base-lighter text-base-darker">Context: {contextDocs.length}</span>
                <span className="usa-tag radius-md margin-right-1 bg-accent-warm">Templates: {templates.length}</span>
                <span className="usa-tag radius-md bg-info">Sessions: {sessions.length}</span>
              </p>
            </div>
            <div className="display-flex flex-column flex-align-end">
              <div className="usa-button-group usa-button-group--segmented">
                <button
                  className={`usa-button ${viewMode === "wizard" ? "" : "usa-button--outline"}`}
                  onClick={() => setViewMode("wizard")}
                >
                  Wizard
                </button>
                <button
                  className={`usa-button ${viewMode === "manager" ? "" : "usa-button--outline"}`}
                  onClick={() => setViewMode("manager")}
                >
                  Manage Files
                </button>
              </div>
            </div>
          </div>

          {viewMode === "wizard" ? (
            <section aria-label="Wizard flow">
              <div className="usa-step-indicator usa-step-indicator--counters-sm margin-bottom-4" aria-label="progress">
                <ol className="usa-step-indicator__segments">
                  <li className={`usa-step-indicator__segment ${wizardStep === 0 ? "usa-step-indicator__segment--current" : wizardStep > 0 ? "usa-step-indicator__segment--complete" : ""}`}>
                    <span className="usa-step-indicator__segment-label">Welcome <span className="usa-sr-only">{wizardStep === 0 ? "not completed" : "completed"}</span></span>
                  </li>
                  <li className={`usa-step-indicator__segment ${wizardStep === 1 ? "usa-step-indicator__segment--current" : wizardStep > 1 ? "usa-step-indicator__segment--complete" : ""}`}>
                    <span className="usa-step-indicator__segment-label">Context <span className="usa-sr-only">{wizardStep === 1 ? "not completed" : wizardStep > 1 ? "completed" : ""}</span></span>
                  </li>
                  <li className={`usa-step-indicator__segment ${wizardStep === 2 ? "usa-step-indicator__segment--current" : wizardStep > 2 ? "usa-step-indicator__segment--complete" : ""}`}>
                    <span className="usa-step-indicator__segment-label">Templates <span className="usa-sr-only">{wizardStep === 2 ? "not completed" : wizardStep > 2 ? "completed" : ""}</span></span>
                  </li>
                  <li className={`usa-step-indicator__segment ${wizardStep === 3 ? "usa-step-indicator__segment--current" : ""}`}>
                    <span className="usa-step-indicator__segment-label">Generate <span className="usa-sr-only">{wizardStep === 3 ? "not completed" : ""}</span></span>
                  </li>
                </ol>
              </div>

              {wizardStep === 0 ? (
                <div className="usa-card margin-top-4">
                  <div className="usa-card__container">
                    <div className="usa-card__header">
                      <h2 className="usa-card__heading font-heading-lg">Welcome to the SOW Agent</h2>
                    </div>
                    <div className="usa-card__body">
                      <p className="margin-top-0 font-body-lg text-light">This wizard guides you through assembling a complete, compliant Statement of Work.</p>
                      <ol className="usa-list font-body-md line-height-sans-4">
                        <li className="margin-bottom-2"><strong>Upload context:</strong> Add ERDs, PDFs, Word docs, spreadsheets, or diagrams.</li>
                        <li className="margin-bottom-2"><strong>Select template:</strong> Upload boilerplate templates and pick one active master.</li>
                        <li className="margin-bottom-2"><strong>Generate:</strong> Select your session and provide any final instructions.</li>
                        <li className="margin-bottom-2"><strong>Merge & Export:</strong> The agent generates draft content and merges it flawlessly into your active template.</li>
                      </ol>
                    </div>
                    <div className="usa-card__footer">
                      <button className="usa-button usa-button--big" onClick={nextStep}>Get Started</button>
                    </div>
                  </div>
                </div>
              ) : null}

              {wizardStep === 1 ? (
                <div className="usa-card">
                  <div className="usa-card__container">
                    <div className="usa-card__header">
                      <h2 className="usa-card__heading font-heading-lg">Upload Context Documents</h2>
                    </div>
                    <div className="usa-card__body">
                      <p className="text-base margin-top-0">Provide the background materials (PDFs, Word, Excel, CSV) the agent will use to write the SOW.</p>
                      <div
                        className="dropzone margin-top-2 margin-bottom-3"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          uploadManyContext(Array.from(e.dataTransfer.files || []));
                        }}
                      >
                        <label className="usa-label margin-0 cursor-pointer" htmlFor="context-file">Drag and drop files here, or click to browse</label>
                        <input className="usa-file-input display-none" id="context-file" type="file" multiple onChange={onUploadContext} />
                      </div>
                      
                      {contextDocs.length > 0 && (
                        <ul className="usa-list">
                          {contextDocs.map((d) => (
                            <li key={d.id} className="display-flex flex-align-center margin-bottom-1">
                              <span className="text-bold margin-right-1">{d.filename}</span>
                              <span className="text-base text-italic margin-right-2">({d.kind})</span>
                              <button className="usa-button usa-button--unstyled text-secondary" onClick={() => onDeleteContext(d.id)}>
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="usa-card__footer display-flex">
                      <button className="usa-button usa-button--outline" onClick={prevStep}>Back</button>
                      <button className="usa-button margin-left-auto" onClick={nextStep}>Next step</button>
                    </div>
                  </div>
                </div>
              ) : null}

              {wizardStep === 2 ? (
                <div className="usa-card">
                  <div className="usa-card__container">
                    <div className="usa-card__header">
                      <h2 className="usa-card__heading font-heading-lg">Upload & Select Templates</h2>
                    </div>
                    <div className="usa-card__body">
                      <p className="text-base margin-top-0">Upload your boilerplate SOW templates (.docx) and select exactly one to serve as the master output format.</p>
                      <div
                        className="dropzone margin-top-2 margin-bottom-3"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          uploadManyTemplates(Array.from(e.dataTransfer.files || []));
                        }}
                      >
                        <label className="usa-label margin-0 cursor-pointer" htmlFor="template-file">Drag and drop templates here, or click to browse</label>
                        <input className="usa-file-input display-none" id="template-file" type="file" multiple onChange={onUploadTemplate} />
                      </div>
                      
                      {templates.length > 0 && (
                        <ul className="usa-list usa-list--unstyled">
                          {templates.map((t) => (
                            <li key={t.id} className={`display-flex flex-align-center margin-bottom-2 padding-2 radius-md border ${activeTemplateId === t.id ? 'bg-primary-lighter border-primary' : 'bg-base-lightest border-base-lighter'}`}>
                              <div className="usa-radio">
                                <input
                                  className="usa-radio__input"
                                  type="radio"
                                  name="active-template"
                                  id={`tpl-${t.id}`}
                                  checked={activeTemplateId === t.id}
                                  onChange={() => onActivateTemplate(t.id)}
                                />
                                <label className="usa-radio__label margin-top-0" htmlFor={`tpl-${t.id}`}>
                                  <span className="text-bold">{t.filename}</span>
                                </label>
                              </div>
                              <button className="usa-button usa-button--unstyled text-secondary margin-left-auto" onClick={() => onDeleteTemplate(t.id)}>
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="usa-card__footer display-flex">
                      <button className="usa-button usa-button--outline" onClick={prevStep}>Back</button>
                      <button className="usa-button margin-left-auto" onClick={nextStep}>Next step</button>
                    </div>
                  </div>
                </div>
              ) : null}

              {wizardStep === 3 ? (
                <>
                  <div className="usa-card margin-bottom-4">
                    <div className="usa-card__container">
                      <div className="usa-card__header">
                        <h2 className="usa-card__heading font-heading-lg">Chat, Generate, and Export</h2>
                      </div>
                      <div className="usa-card__body">
                        <div className="chat-panel">
                          {messages.length === 0 ? (
                            <div className="text-center text-base margin-y-auto padding-y-4">
                              <p>No messages yet. Add a note or instructions to begin.</p>
                            </div>
                          ) : null}
                          {messages.map((m) => (
                            <article key={m.id} className={`chat-message ${m.role}`}>
                              <h3>{m.role === "assistant" ? "Agent" : "You"}</h3>
                              <p>{m.content}</p>
                            </article>
                          ))}
                        </div>
                        
                        <form className="usa-form maxw-full margin-top-3" onSubmit={onSendMessage}>
                          <label className="usa-label" htmlFor="chat-message">Add context note for this session</label>
                          <div className="display-flex flex-align-end gap-1">
                            <textarea
                              className="usa-textarea flex-fill margin-right-1"
                              id="chat-message"
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              rows="2"
                            />
                            <button className="usa-button margin-bottom-1" disabled={loading || !sessionId}>Send</button>
                          </div>
                        </form>
                        
                        <hr className="margin-y-4 border-base-lighter" />
                        
                        <label className="usa-label text-bold" htmlFor="extra-instructions">
                          Final Generation Instructions
                        </label>
                        <p className="usa-hint margin-top-05">Give the agent any specific directions before drafting the SOW (e.g. "Focus on section 3.2", "Adopt a strict tone").</p>
                        <textarea
                          className="usa-textarea"
                          id="extra-instructions"
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          rows="3"
                        />
                        
                        <div className="margin-top-3 display-flex gap-2">
                          <button className="usa-button usa-button--big" onClick={onGenerate} disabled={loading || !sessionId}>
                            Generate Draft
                          </button>
                          <button
                            className="usa-button usa-button--big usa-button--accent-warm"
                            onClick={onMergeDownload}
                            disabled={loading || !sessionId || !activeTemplateId}
                          >
                            Export to Word
                          </button>
                        </div>
                      </div>
                      <div className="usa-card__footer">
                        <button className="usa-button usa-button--outline" onClick={prevStep}>Back</button>
                      </div>
                    </div>
                  </div>
                  
                  {generation?.sections?.full_markdown ? (
                    <section className="margin-top-4" aria-label="Generated SOW preview">
                      <h2 className="font-heading-lg border-bottom border-base-lighter padding-bottom-1 margin-bottom-2">Draft Preview</h2>
                      <pre className="preview">{generation.sections.full_markdown}</pre>
                    </section>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : (
            <section aria-label="File manager">
              <div className="usa-card margin-bottom-4 shadow-1">
                <div className="usa-card__container">
                  <div className="usa-card__header">
                    <h2 className="usa-card__heading font-heading-lg">Context Document Manager</h2>
                  </div>
                  <div className="usa-card__body">
                    <div
                        className="dropzone margin-bottom-3"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          uploadManyContext(Array.from(e.dataTransfer.files || []));
                        }}
                      >
                        <label className="usa-label margin-0 cursor-pointer" htmlFor="context-file-manager">Drag and drop files here, or click to browse</label>
                        <input className="usa-file-input display-none" id="context-file-manager" type="file" multiple onChange={onUploadContext} />
                    </div>
                    {contextDocs.length > 0 ? (
                      <ul className="usa-list usa-list--unstyled">
                        {contextDocs.map((d) => (
                          <li key={d.id} className="display-flex flex-align-center border-bottom border-base-lighter padding-y-2">
                            <span className="text-bold margin-right-1">{d.filename}</span>
                            <span className="usa-tag radius-md bg-base-light text-base-darker margin-right-2">{d.kind}</span>
                            <button className="usa-button usa-button--unstyled text-secondary margin-left-auto" onClick={() => onDeleteContext(d.id)}>
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-italic text-base">No context documents uploaded yet.</p>}
                  </div>
                </div>
              </div>

              <div className="usa-card shadow-1">
                <div className="usa-card__container">
                  <div className="usa-card__header">
                    <h2 className="usa-card__heading font-heading-lg">Template Manager</h2>
                  </div>
                  <div className="usa-card__body">
                    <div
                        className="dropzone margin-bottom-3"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          uploadManyTemplates(Array.from(e.dataTransfer.files || []));
                        }}
                      >
                        <label className="usa-label margin-0 cursor-pointer" htmlFor="template-file-manager">Drag and drop templates here, or click to browse</label>
                        <input className="usa-file-input display-none" id="template-file-manager" type="file" multiple onChange={onUploadTemplate} />
                    </div>
                    {templates.length > 0 ? (
                      <ul className="usa-list usa-list--unstyled">
                        {templates.map((t) => (
                          <li key={t.id} className={`display-flex flex-align-center border-bottom border-base-lighter padding-y-2 ${activeTemplateId === t.id ? 'bg-primary-lighter padding-x-1' : ''}`}>
                            <div className="usa-radio">
                              <input
                                className="usa-radio__input"
                                type="radio"
                                name="active-template-manager"
                                id={`tpl-mgr-${t.id}`}
                                checked={activeTemplateId === t.id}
                                onChange={() => onActivateTemplate(t.id)}
                              />
                              <label className="usa-radio__label margin-top-0" htmlFor={`tpl-mgr-${t.id}`}>
                                <span className="text-bold">{t.filename}</span>
                                {activeTemplateId === t.id && <span className="usa-tag radius-md bg-accent-warm margin-left-2">Active Master</span>}
                              </label>
                            </div>
                            <button className="usa-button usa-button--unstyled text-secondary margin-left-auto" onClick={() => onDeleteTemplate(t.id)}>
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-italic text-base">No templates uploaded yet.</p>}
                  </div>
                </div>
              </div>
            </section>
          )}
        </section>
      </main>

      {/* Slim Footer */}
      <footer className="slim-footer" role="contentinfo">
        <div className="slim-footer-content display-flex flex-justify flex-align-center padding-y-2 padding-x-3">
          <p className="margin-0 text-base font-sans-xs text-base-light">
            Federal SOW Writer Agent &bull; Not for official distribution without human and legal review.
          </p>
          <ul className="usa-list usa-list--unstyled display-flex gap-3 margin-0 font-sans-xs">
            <li><a href="#" className="text-base-light text-no-underline hover:text-white">Privacy</a></li>
            <li><a href="#" className="text-base-light text-no-underline hover:text-white">Accessibility</a></li>
            <li><a href="#" className="text-base-light text-no-underline hover:text-white">FOIA</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

export default App;
