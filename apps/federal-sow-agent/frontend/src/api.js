const API_BASE = "http://127.0.0.1:8000";

async function request(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(opts.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Request failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

export const api = {
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request("/auth/me"),
  listWorkspaces: () => request("/workspaces"),
  createWorkspace: (name) => request("/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
  listSessions: (workspaceId) => request(`/workspaces/${workspaceId}/sessions`),
  createSession: (workspaceId, title) =>
    request(`/workspaces/${workspaceId}/sessions`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  listMessages: (workspaceId, sessionId) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/messages`),
  addMessage: (workspaceId, sessionId, content) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  listContext: (workspaceId) => request(`/workspaces/${workspaceId}/context`),
  listTemplates: (workspaceId) => request(`/workspaces/${workspaceId}/templates`),
  uploadContext: (workspaceId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request(`/workspaces/${workspaceId}/context/upload`, {
      method: "POST",
      body: fd,
    });
  },
  deleteContext: (workspaceId, assetId) =>
    request(`/workspaces/${workspaceId}/context/${assetId}`, {
      method: "DELETE",
    }),
  uploadTemplate: (workspaceId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request(`/workspaces/${workspaceId}/templates/upload`, {
      method: "POST",
      body: fd,
    });
  },
  deleteTemplate: (workspaceId, assetId) =>
    request(`/workspaces/${workspaceId}/templates/${assetId}`, {
      method: "DELETE",
    }),
  activateTemplate: (workspaceId, assetId) =>
    request(`/workspaces/${workspaceId}/templates/${assetId}/activate`, {
      method: "POST",
    }),
  generate: (workspaceId, sessionId, additionalInstructions) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/generate`, {
      method: "POST",
      body: JSON.stringify({ additional_instructions: additionalInstructions }),
    }),
  merge: (workspaceId, sessionId, templateAssetId) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/merge`, {
      method: "POST",
      body: JSON.stringify({ template_asset_id: templateAssetId, use_latest_generation: true }),
    }),
  downloadUrl: (path) => `${API_BASE}${path}`,
};

