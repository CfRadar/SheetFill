import {
  BulkAssignResponse,
  PutJsonResponse,
  SessionState,
} from "./types";

const BASE_URL = "/api";

export async function uploadSheet(file: File): Promise<SessionState> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/sheets/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to analyze workbook");
  }

  const data = await res.json();
  return getSession(data.session_id);
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to load session");
  }
  return res.json();
}

export async function addSlots(sessionId: string, count: number): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}/add-slots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to add design slots");
  }
  return getSession(sessionId);
}

export async function deleteDesign(sessionId: string, designId: string, force: boolean = false): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}?force=${force}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to delete design");
  }
  return getSession(sessionId);
}

export async function saveDesignJson(sessionId: string, designId: string, rawText: string): Promise<PutJsonResponse> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}/json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to validate JSON");
  }
  return res.json();
}

export async function saveDesignImages(
  sessionId: string,
  designId: string,
  urls: (string | null)[],
  productLink?: string | null,
  unlock: boolean = false
): Promise<void> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}/images`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls, product_link: productLink || null, unlock }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to save image links");
  }
}

export async function saveDesignSizes(sessionId: string, designId: string, sizes: string[]): Promise<void> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}/sizes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sizes }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to save sizes");
  }
}

export async function bulkAssignJson(sessionId: string, rawText: string): Promise<BulkAssignResponse> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}/bulk-assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to parse batch JSON");
  }
  return res.json();
}

export async function confirmBulkAssign(
  sessionId: string,
  pairs: { design_id: string; json_index: number; parsed_json: any }[]
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}/bulk-assign/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairs }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to apply matched JSON");
  }
  return getSession(sessionId);
}

export async function getJsonTemplate(sessionId: string, designId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}/json-template`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to fetch template skeleton");
  }
  return res.json();
}

export async function generateWorkbook(sessionId: string, mode: "ready_only" | "all_or_nothing"): Promise<{ download_url: string; report: any }> {
  const res = await fetch(`${BASE_URL}/sheets/${sessionId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || "Failed to generate workbook");
  }
  return res.json();
}

export async function getAllowedValues(attribute: string): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/allowed-values/${attribute}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.values || [];
}
