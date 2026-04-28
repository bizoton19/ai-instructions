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

  const activeTemplateId = useMemo(() => (templates[0] ? templates[0].id : null), [templates]);

  useEffect(() => {
    api.me()
      .then(setUser)
      .then(loadWorkspaces)
      .catch(() => {});
  }, []);

  async function loadWorkspaces() {
    const data = await api.listWorkspaces();
    setWorkspaces(data);
    if (!workspaceId && data.length > 0) {
      setWorkspaceId(data[0].id);
    }
  }

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      const [s, c, t] = await Promise.all([
        api.listSessions(workspaceId),
        api.listContext(workspaceId),
        api.listTemplates(workspaceId),
      ]);
      setSessions(s);
      setContextDocs(c);
      setTemplates(t);
      if (s.length > 0) {
        setSessionId(s[0].id);
      }
    })().catch((e) => setNotice(e.message));
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
    const name = prompt("Workspace name");
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

  async function onUploadContext(e) {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    setLoading(true);
    try {
      await api.uploadContext(workspaceId, file);
      setContextDocs(await api.listContext(workspaceId));
      setNotice(`Uploaded context: ${file.name}`);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function onUploadTemplate(e) {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    setLoading(true);
    try {
      await api.uploadTemplate(workspaceId, file);
      setTemplates(await api.listTemplates(workspaceId));
      setNotice(`Uploaded template: ${file.name}`);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
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
          <p className="usa-intro">
            Draft statements of work using uploaded context and approved templates. Generated drafts require human and counsel review.
          </p>
          {notice ? <div className="usa-alert usa-alert--info"><div className="usa-alert__body">{notice}</div></div> : null}

          {!user ? (
            <section className="usa-section">
              <h2>Sign in</h2>
              <p>Prototype sign-in for lab use only.</p>
              <form className="usa-form maxw-mobile-lg" onSubmit={onLogin}>
                <label className="usa-label" htmlFor="email">Email</label>
                <input className="usa-input" id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <label className="usa-label" htmlFor="password">Password</label>
                <input className="usa-input" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="usa-button margin-top-2" disabled={loading}>Sign in</button>
              </form>
            </section>
          ) : (
            <div className="grid-row grid-gap">
              <aside className="desktop:grid-col-3 tablet:grid-col-4 grid-col-12">
                <section aria-label="Workspace navigation">
                  <h2>Workspaces</h2>
                  <button className="usa-button usa-button--outline margin-bottom-1" onClick={onCreateWorkspace}>New workspace</button>
                  <ul className="usa-list usa-list--unstyled panel-list">
                    {workspaces.map((ws) => (
                      <li key={ws.id}>
                        <button className={`usa-button usa-button--unstyled ${workspaceId === ws.id ? "is-active" : ""}`} onClick={() => setWorkspaceId(ws.id)}>
                          {ws.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
                <section aria-label="Agent sessions">
                  <h2>Agent sessions</h2>
                  <button className="usa-button usa-button--outline margin-bottom-1" onClick={onCreateSession}>New session</button>
                  <ul className="usa-list usa-list--unstyled panel-list">
                    {sessions.map((s) => (
                      <li key={s.id}>
                        <button className={`usa-button usa-button--unstyled ${sessionId === s.id ? "is-active" : ""}`} onClick={() => setSessionId(s.id)}>
                          {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </aside>

              <section className="desktop:grid-col-6 tablet:grid-col-8 grid-col-12" aria-label="Agent conversation">
                <h2>SOW drafting chat</h2>
                <div className="chat-panel">
                  {messages.map((m) => (
                    <article key={m.id} className={`chat-message ${m.role}`}>
                      <h3>{m.role === "assistant" ? "Agent" : "User"}</h3>
                      <p>{m.content}</p>
                    </article>
                  ))}
                </div>
                <form className="usa-form" onSubmit={onSendMessage}>
                  <label className="usa-label" htmlFor="chat-message">Add context note for this session</label>
                  <textarea
                    className="usa-textarea"
                    id="chat-message"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                  />
                  <button className="usa-button margin-top-1" disabled={loading || !sessionId}>Send</button>
                </form>

                <label className="usa-label margin-top-3" htmlFor="extra-instructions">
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
                {generation?.sections?.full_markdown ? (
                  <section className="margin-top-3">
                    <h2>Latest generated SOW preview</h2>
                    <pre className="preview">{generation.sections.full_markdown}</pre>
                  </section>
                ) : null}
              </section>

              <aside className="desktop:grid-col-3 grid-col-12" aria-label="Uploads">
                <h2>Context documents</h2>
                <label className="usa-label" htmlFor="context-file">Upload context</label>
                <input className="usa-file-input" id="context-file" type="file" onChange={onUploadContext} />
                <ul className="usa-list">
                  {contextDocs.map((d) => (
                    <li key={d.id}>
                      {d.filename} ({d.kind})
                    </li>
                  ))}
                </ul>

                <h2>Templates</h2>
                <label className="usa-label" htmlFor="template-file">Upload SOW template (.docx)</label>
                <input className="usa-file-input" id="template-file" type="file" onChange={onUploadTemplate} />
                <ul className="usa-list">
                  {templates.map((t) => (
                    <li key={t.id}>{t.filename}</li>
                  ))}
                </ul>
              </aside>
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

