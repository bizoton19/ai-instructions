import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("dev@example.gov");
  const [password, setPassword] = useState("devpassword-change-me");

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
    api.me()
      .then((resp) => {
        if (resp?.authenticated && resp.user) {
          setUser(resp.user);
          return loadWorkspaces();
        }
        return null;
      })
      .catch(() => {});
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

  async function onLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const me = await api.login(email, password);
      setUser(me);
      await loadWorkspaces();
      setNotice("Signed in.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

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
        // Sequential upload keeps server-side extraction predictable.
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
          <nav className="usa-breadcrumb" aria-label="Breadcrumbs">
            <ol className="usa-breadcrumb__list">
              <li className="usa-breadcrumb__list-item">
                <a href="#" className="usa-breadcrumb__link">
                  <span>Workspaces</span>
                </a>
              </li>
              <li className="usa-breadcrumb__list-item usa-current" aria-current="page">
                SOW Agent
              </li>
            </ol>
          </nav>

          <h1>Federal Statement of Work Workspace</h1>

          {notice ? (
            <div className="usa-alert usa-alert--info margin-bottom-3">
              <div className="usa-alert__body">{notice}</div>
            </div>
          ) : null}

          {!user ? (
            <section className="usa-section bg-base-lightest radius-lg padding-3">
              <h2 className="margin-top-0">Sign in</h2>
              <p>Prototype sign-in for lab use only.</p>
              <form className="usa-form maxw-mobile-lg" onSubmit={onLogin} aria-label="Prototype sign in form">
                <label className="usa-label" htmlFor="email">Email</label>
                <input className="usa-input" id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <label className="usa-label" htmlFor="password">Password</label>
                <input className="usa-input" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="usa-button margin-top-2" disabled={loading}>Sign in</button>
              </form>
            </section>
          ) : (
            <div className="workspace-shell">
              <aside className="workspace-rail" aria-label="Workspace and session navigation">
                <div className="workspace-rail-section">
                  <h2>Workspaces</h2>
                  <button className="usa-button usa-button--outline width-full margin-bottom-1" onClick={onCreateWorkspace}>New workspace</button>
                  <ul className="usa-list usa-list--unstyled panel-list margin-bottom-2">
                    {workspaces.map((ws) => (
                      <li key={ws.id} className="margin-bottom-1">
                        <button className={`usa-button usa-button--unstyled ${workspaceId === ws.id ? "is-active" : ""}`} onClick={() => setWorkspaceId(ws.id)}>
                          {ws.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="workspace-rail-section">
                  <h2>Agent sessions</h2>
                  <button className="usa-button usa-button--outline width-full margin-bottom-1" onClick={onCreateSession}>New session</button>
                  <ul className="usa-list usa-list--unstyled panel-list margin-bottom-0">
                    {sessions.map((s) => (
                      <li key={s.id} className="margin-bottom-1">
                        <button className={`usa-button usa-button--unstyled ${sessionId === s.id ? "is-active" : ""}`} onClick={() => setSessionId(s.id)}>
                          {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>

              <section className="workspace-canvas" aria-label="Workspace canvas">
                <div className="workspace-toolbar">
                  <div>
                    <h2 className="margin-0">{activeWorkspace?.name || "Default workspace"}</h2>
                    <p className="margin-y-05">Context: {contextDocs.length} | Templates: {templates.length} | Sessions: {sessions.length}</p>
                  </div>
                  <div className="display-flex flex-column">
                    <button
                      className={`usa-button usa-button--unstyled text-left ${viewMode === "wizard" ? "is-active" : ""}`}
                      onClick={() => setViewMode("wizard")}
                    >
                      Wizard flow
                    </button>
                    <button
                      className={`usa-button usa-button--unstyled text-left ${viewMode === "manager" ? "is-active" : ""}`}
                      onClick={() => setViewMode("manager")}
                    >
                      Manage files
                    </button>
                  </div>
                </div>

                {viewMode === "wizard" ? (
                  <section aria-label="Wizard flow">
                  <div className="usa-process-list margin-bottom-2">
                    <ul className="usa-process-list__list">
                      <li className={`usa-process-list__item ${wizardStep >= 0 ? "usa-process-list__item--current" : ""}`}>
                        Welcome
                      </li>
                      <li className={`usa-process-list__item ${wizardStep >= 1 ? "usa-process-list__item--current" : ""}`}>
                        Context documents
                      </li>
                      <li className={`usa-process-list__item ${wizardStep >= 2 ? "usa-process-list__item--current" : ""}`}>
                        Templates
                      </li>
                      <li className={`usa-process-list__item ${wizardStep >= 3 ? "usa-process-list__item--current" : ""}`}>
                        Generate and export
                      </li>
                    </ul>
                  </div>

                  {wizardStep === 0 ? (
                    <div className="usa-card">
                      <div className="usa-card__container">
                        <div className="usa-card__header">
                          <h2 className="usa-card__heading">Welcome</h2>
                        </div>
                        <div className="usa-card__body">
                          <p className="margin-top-0">Use this wizard to build a complete SOW package in sequence.</p>
                          <ol>
                            <li>Upload context documents (PDF, Word, spreadsheets, diagrams).</li>
                            <li>Upload one or more templates and select exactly one active template.</li>
                            <li>Create or select a session and generate draft output.</li>
                            <li>Merge draft output into the active template and export.</li>
                          </ol>
                        </div>
                        <div className="usa-card__footer">
                          <button className="usa-button" onClick={nextStep}>Start wizard</button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {wizardStep === 1 ? (
                    <div className="usa-card">
                      <div className="usa-card__container">
                        <div className="usa-card__header">
                          <h2 className="usa-card__heading">Step 1: Context documents</h2>
                        </div>
                        <div className="usa-card__body">
                          <label className="usa-label" htmlFor="context-file">Upload context files</label>
                          <input className="usa-file-input" id="context-file" type="file" multiple onChange={onUploadContext} />
                          <div
                            className="dropzone margin-top-1 margin-bottom-1"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              uploadManyContext(Array.from(e.dataTransfer.files || []));
                            }}
                          >
                            Drag and drop context files here
                          </div>
                          <ul className="usa-list">
                            {contextDocs.map((d) => (
                              <li key={d.id}>
                                {d.filename} ({d.kind})
                                <button className="usa-button usa-button--unstyled margin-left-1" onClick={() => onDeleteContext(d.id)}>
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="usa-card__footer">
                          <button className="usa-button usa-button--outline" onClick={prevStep}>Back</button>
                          <button className="usa-button margin-left-1" onClick={nextStep}>Next</button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {wizardStep === 2 ? (
                    <div className="usa-card">
                      <div className="usa-card__container">
                        <div className="usa-card__header">
                          <h2 className="usa-card__heading">Step 2: Templates</h2>
                        </div>
                        <div className="usa-card__body">
                          <label className="usa-label" htmlFor="template-file">Upload template files</label>
                          <input className="usa-file-input" id="template-file" type="file" multiple onChange={onUploadTemplate} />
                          <div
                            className="dropzone margin-top-1 margin-bottom-1"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              uploadManyTemplates(Array.from(e.dataTransfer.files || []));
                            }}
                          >
                            Drag and drop template files here
                          </div>
                          <p>Select one active template used by the agent.</p>
                          <ul className="usa-list">
                            {templates.map((t) => (
                              <li key={t.id}>
                                <label className="display-flex flex-align-center">
                                  <input
                                    type="radio"
                                    name="active-template"
                                    checked={activeTemplateId === t.id}
                                    onChange={() => onActivateTemplate(t.id)}
                                  />
                                  <span className="margin-left-1">{t.filename}</span>
                                </label>
                                <button className="usa-button usa-button--unstyled margin-left-2" onClick={() => onDeleteTemplate(t.id)}>
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="usa-card__footer">
                          <button className="usa-button usa-button--outline" onClick={prevStep}>Back</button>
                          <button className="usa-button margin-left-1" onClick={nextStep}>Next</button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {wizardStep === 3 ? (
                    <>
                      <div className="usa-card margin-bottom-2">
                        <div className="usa-card__container">
                          <div className="usa-card__header">
                            <h2 className="usa-card__heading">Step 3: Generate and export</h2>
                          </div>
                          <div className="usa-card__body">
                            <div className="chat-panel">
                              {messages.map((m) => (
                                <article key={m.id} className={`chat-message ${m.role}`}>
                                  <h3>{m.role === "assistant" ? "Agent" : "User"}</h3>
                                  <p>{m.content}</p>
                                </article>
                              ))}
                            </div>
                            <form className="usa-form margin-top-2" onSubmit={onSendMessage}>
                              <label className="usa-label" htmlFor="chat-message">Add context note for this session</label>
                              <textarea
                                className="usa-textarea"
                                id="chat-message"
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                              />
                              <button className="usa-button margin-top-1" disabled={loading || !sessionId}>Send</button>
                            </form>
                            <label className="usa-label margin-top-2" htmlFor="extra-instructions">
                              Additional generation instructions
                            </label>
                            <textarea
                              className="usa-textarea"
                              id="extra-instructions"
                              value={instructions}
                              onChange={(e) => setInstructions(e.target.value)}
                            />
                            <div className="margin-top-2">
                              <button className="usa-button" onClick={onGenerate} disabled={loading || !sessionId}>
                                Generate SOW Draft
                              </button>
                              <button
                                className="usa-button usa-button--accent-warm margin-left-1"
                                onClick={onMergeDownload}
                                disabled={loading || !sessionId || !activeTemplateId}
                              >
                                Merge Into Template
                              </button>
                            </div>
                          </div>
                          <div className="usa-card__footer">
                            <button className="usa-button usa-button--outline" onClick={prevStep}>Back</button>
                          </div>
                        </div>
                      </div>
                      {generation?.sections?.full_markdown ? (
                        <section className="margin-top-3" aria-label="Generated SOW preview">
                          <h2>Latest generated SOW preview</h2>
                          <pre className="preview">{generation.sections.full_markdown}</pre>
                        </section>
                      ) : null}
                    </>
                  ) : null}
                  </section>
                ) : (
                  <section aria-label="File manager">
                  <div className="usa-card margin-bottom-2">
                    <div className="usa-card__container">
                      <div className="usa-card__header">
                        <h2 className="usa-card__heading">Context document manager</h2>
                      </div>
                      <div className="usa-card__body">
                        <label className="usa-label" htmlFor="context-file-manager">Upload context files</label>
                        <input className="usa-file-input" id="context-file-manager" type="file" multiple onChange={onUploadContext} />
                        <ul className="usa-list">
                          {contextDocs.map((d) => (
                            <li key={d.id}>
                              {d.filename} ({d.kind})
                              <button className="usa-button usa-button--unstyled margin-left-1" onClick={() => onDeleteContext(d.id)}>
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="usa-card">
                    <div className="usa-card__container">
                      <div className="usa-card__header">
                        <h2 className="usa-card__heading">Template manager</h2>
                      </div>
                      <div className="usa-card__body">
                        <label className="usa-label" htmlFor="template-file-manager">Upload templates</label>
                        <input className="usa-file-input" id="template-file-manager" type="file" multiple onChange={onUploadTemplate} />
                        <ul className="usa-list">
                          {templates.map((t) => (
                            <li key={t.id}>
                              <label className="display-flex flex-align-center">
                                <input
                                  type="radio"
                                  name="active-template-manager"
                                  checked={activeTemplateId === t.id}
                                  onChange={() => onActivateTemplate(t.id)}
                                />
                                <span className="margin-left-1">{t.filename}</span>
                              </label>
                              <button className="usa-button usa-button--unstyled margin-left-2" onClick={() => onDeleteTemplate(t.id)}>
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  </section>
                )}
              </section>
            </div>
          )}
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

