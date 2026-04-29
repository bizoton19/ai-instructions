const API_BASE = "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(message, status, detailPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detailPayload = detailPayload;
  }
}

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
    let parsed = null;
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = null;
    }
    const rawDetail = parsed && typeof parsed === "object" && "detail" in parsed ? parsed.detail : parsed;
    const message =
      typeof rawDetail === "string"
        ? rawDetail
        : rawDetail && typeof rawDetail === "object" && rawDetail.message
          ? rawDetail.message
          : txt || `Request failed: ${res.status}`;
    throw new ApiError(message, res.status, typeof rawDetail === "object" && rawDetail !== null ? rawDetail : null);
  }
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

export const api = {
  listAgents: () => request("/agents"),
  listPipeline: () => request("/agents/pipeline"),
  listWorkspaces: () => request("/workspaces"),
  createWorkspace: (name) => request("/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
  listSessions: (workspaceId) => request(`/workspaces/${workspaceId}/sessions`),
  createSession: (workspaceId, title, agentType) =>
    request(`/workspaces/${workspaceId}/sessions`, {
      method: "POST",
      body: JSON.stringify({ title, agent_type: agentType }),
    }),
  updateSession: (workspaceId, sessionId, payload) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
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
  pipelineAdvance: (workspaceId, sessionId, body) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/pipeline/advance`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  pipelineReset: (workspaceId, sessionId) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/pipeline/reset`, {
      method: "POST",
    }),
  merge: (workspaceId, sessionId, templateAssetId) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/merge`, {
      method: "POST",
      body: JSON.stringify({ template_asset_id: templateAssetId, use_latest_generation: true }),
    }),
  downloadUrl: (path) => `${API_BASE}${path}`,
};

