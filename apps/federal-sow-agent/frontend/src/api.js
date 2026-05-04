const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, detailPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detailPayload = detailPayload;
  }
}

async function request(path, opts = {}) {
  const { timeoutMs = 90000, signal, ...fetchOpts } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const compositeSignal = signal || controller.signal;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      signal: compositeSignal,
      credentials: "include",
      headers: {
        ...(fetchOpts.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(fetchOpts.headers || {}),
      },
      ...fetchOpts,
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`, 408, null);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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

function parseFilenameFromContentDisposition(header) {
  if (!header) return null;
  const star = header.match(/filename\*=UTF-8''([^;\n]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted) return quoted[1];
  const loose = header.match(/filename=([^;\n]+)/i);
  if (loose) return loose[1].trim().replace(/^"|"$/g, "");
  return null;
}

/** Fetches binary from API and triggers a save-as. Use after export (avoid window.open popup block after await). */
export async function downloadFileByPath(downloadPath) {
  if (!downloadPath || typeof downloadPath !== "string") {
    throw new Error("Missing download path");
  }
  const url = downloadPath.startsWith("http") ? downloadPath : `${API_BASE}${downloadPath}`;
  const res = await fetch(url, { credentials: "include", method: "GET" });
  if (!res.ok) {
    const t = await res.text();
    throw new ApiError(t.slice(0, 400) || `Download failed (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const fromHeader = parseFilenameFromContentDisposition(res.headers.get("Content-Disposition"));
  let fallback = downloadPath.split("/").pop() || "download";
  try {
    fallback = decodeURIComponent(fallback);
  } catch {
    /* keep raw */
  }
  const filename = fromHeader || fallback;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const api = {
  getObservability: () => request("/observability"),
  listAgents: () => request("/agents"),
  listPipeline: () => request("/agents/pipeline"),
  listWorkspaces: () => request("/workspaces"),
  createWorkspace: (name) => request("/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
  patchWorkspace: (workspaceId, body) =>
    request(`/workspaces/${workspaceId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteWorkspace: (workspaceId) => request(`/workspaces/${workspaceId}`, { method: "DELETE" }),
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
      timeoutMs: 180000,
    });
  },
  renameContext: (workspaceId, assetId, filename) =>
    request(`/workspaces/${workspaceId}/context/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({ filename }),
    }),
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
      timeoutMs: 180000,
    });
  },
  renameTemplate: (workspaceId, assetId, filename) =>
    request(`/workspaces/${workspaceId}/templates/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({ filename }),
    }),
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
  listPipelineArtifacts: (workspaceId, sessionId) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/pipeline/artifacts`),
  downloadAllPipelineArtifactsPath: (workspaceId, sessionId) =>
    `/workspaces/${workspaceId}/sessions/${sessionId}/pipeline/artifacts/all/download`,
  /** Primary handoff: one ZIP with per-phase .md, optional *_word_export.docx, MANIFEST.txt */
  downloadPipelineArtifactsPackagePath: (workspaceId, sessionId) =>
    `/workspaces/${workspaceId}/sessions/${sessionId}/pipeline/artifacts/package/download`,
  merge: (workspaceId, sessionId, templateAssetId) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/merge`, {
      method: "POST",
      body: JSON.stringify({ template_asset_id: templateAssetId, use_latest_generation: true }),
    }),
  exportDocument: (workspaceId, sessionId, body) =>
    request(`/workspaces/${workspaceId}/sessions/${sessionId}/export`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  downloadUrl: (path) => `${API_BASE}${path}`,
  patchWorkspaceAgentSettings: (workspaceId, body) =>
    request(`/workspaces/${workspaceId}/agent-settings`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

