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
    const ws = await api.createWorkspace(name);
    await loadWorkspaces();
    setWorkspaceId(ws.id);
  }

  async function onCreateSession() {
    if (!workspaceId) return;
    const s = await api.createSession(workspaceId, "New SOW Session");
    const next = await api.listSessions(workspaceId);
    setSessions(next);
    setSessionId(s.id);
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
    <>
      <a className="usa-skipnav" href="#main-content">
        Skip to main content
      </a>
      <section className="usa-banner" aria-label="Official website of the United States government">
        <div className="usa-accordion">
          <header className="usa-banner__header">
            <div className="usa-banner__inner">
              <div className="grid-col-auto">
                <img
                  aria-hidden="true"
                  className="usa-banner__header-flag"
                  src="https://unpkg.com/@uswds/uswds@3.13.0/dist/img/us_flag_small.png"
                  alt=""
                />
              </div>
              <div className="grid-col-fill tablet:grid-col-auto">
                <p className="usa-banner__header-text">An official website of the United States government</p>
              </div>
            </div>
          </header>
        </div>
      </section>
      <header className="usa-header usa-header--extended" role="banner">
        <div className="usa-navbar">
          <div className="usa-logo" id="extended-logo">
            <em className="usa-logo__text">
              <a href="/" title="Federal SOW Writer Agent">
                Federal SOW Writer Agent
              </a>
            </em>
          </div>
        </div>
      </header>

      <main id="main-content">
        <div className="usa-grid-container usa-section">
          {notice ? (
            <div className="usa-alert usa-alert--info margin-bottom-3">
              <div className="usa-alert__body">{notice}</div>
            </div>
          ) : null}

          <div className="workspace-shell">
            <aside className="workspace-rail" aria-label="Workspace and session navigation">
              <div className="workspace-rail-section">
                <h2>Workspaces</h2>
                <ul className="usa-list usa-list--unstyled panel-list margin-bottom-2">
                  {workspaces.map((ws) => (
                    <li key={ws.id}>
                      <button className={`usa-button usa-button--unstyled ${workspaceId === ws.id ? "is-active" : ""}`} onClick={() => setWorkspaceId(ws.id)}>
                        {ws.name}
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="usa-button usa-button--outline width-full" onClick={onCreateWorkspace}>+ New workspace</button>
              </div>

              <div className="workspace-rail-section">
                <h2>Agent Sessions</h2>
                <ul className="usa-list usa-list--unstyled panel-list margin-bottom-2">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <button className={`usa-button usa-button--unstyled ${sessionId === s.id ? "is-active" : ""}`} onClick={() => setSessionId(s.id)}>
                        {s.title}
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="usa-button usa-button--outline width-full" onClick={onCreateSession}>+ New session</button>
              </div>
            </aside>

            <section className="workspace-canvas" aria-label="Workspace canvas">
              <div className="workspace-toolbar">
                <div>
                  <h2 className="margin-0">{activeWorkspace?.name || "Default workspace"}</h2>
                  <p className="margin-y-05 text-base text-italic">
                    <span className="usa-tag radius-md margin-right-1">Context: {contextDocs.length}</span>
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
                      Manager
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
                            <label className="usa-label margin-0" htmlFor="context-file">Drag and drop files here, or </label>
                            <input className="usa-file-input" id="context-file" type="file" multiple onChange={onUploadContext} />
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
                            <label className="usa-label margin-0" htmlFor="template-file">Drag and drop templates here, or </label>
                            <input className="usa-file-input" id="template-file" type="file" multiple onChange={onUploadTemplate} />
                          </div>
                          
                          {templates.length > 0 && (
                            <ul className="usa-list usa-list--unstyled">
                              {templates.map((t) => (
                                <li key={t.id} className="display-flex flex-align-center margin-bottom-2 bg-base-lightest padding-2 radius-md border border-base-lighter">
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
                                <div className="text-center text-base margin-y-auto">
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
                                  className="usa-textarea"
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
                  <div className="usa-card margin-bottom-4">
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
                            <label className="usa-label margin-0" htmlFor="context-file-manager">Drag and drop files here, or </label>
                            <input className="usa-file-input" id="context-file-manager" type="file" multiple onChange={onUploadContext} />
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

                  <div className="usa-card">
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
                            <label className="usa-label margin-0" htmlFor="template-file-manager">Drag and drop templates here, or </label>
                            <input className="usa-file-input" id="template-file-manager" type="file" multiple onChange={onUploadTemplate} />
                        </div>
                        {templates.length > 0 ? (
                          <ul className="usa-list usa-list--unstyled">
                            {templates.map((t) => (
                              <li key={t.id} className="display-flex flex-align-center border-bottom border-base-lighter padding-y-2">
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
                                    {activeTemplateId === t.id && <span className="usa-tag radius-md bg-accent-warm margin-left-2">Active</span>}
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
          </div>
        </div>
      </main>

      <footer className="usa-footer">
        <div className="usa-footer__secondary-section">
          <div className="usa-grid-container">
            <nav aria-label="Footer links">
              <ul className="usa-list usa-list--unstyled">
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Accessibility Statement</a></li>
                <li><a href="#">Vulnerability Disclosure Policy</a></li>
                <li><a href="#">No FEAR Act Data</a></li>
                <li><a href="#">FOIA</a></li>
              </ul>
            </nav>
          </div>
        </div>
      </footer>
      <div className="usa-identifier">
        <section className="usa-identifier__section usa-identifier__section--usagov" aria-label="Agency identifier">
          <div className="usa-grid-container">
            <p className="usa-identifier__usagov-description">
              Federal SOW Writer Agent. Drafts require human review, contracting review, and legal counsel approval before use.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default App;
