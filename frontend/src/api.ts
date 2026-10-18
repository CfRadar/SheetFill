import {
  BrandMeta,
  BulkAssignResponse,
  PreviewRow,
  PutJsonResponse,
  SessionState,
} from "./types";
import { useAuthStore } from "./auth/authStore";
import { API_BASE } from "./config";

export { API_BASE };
const BASE_URL = `${API_BASE}/api`;

/**
 * Transparent fetch wrapper with authentication header injection,
 * automatic error interception, and exponential retry on 502/503/504.
 */
export async function authFetch(
  input: string,
  init: RequestInit = {},
  retries: number = 2
): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const updatedInit: RequestInit = {
    ...init,
    headers,
  };

  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, updatedInit);

      // Handle auth expiration or replacement globally
      if (res.status === 401 || res.status === 403) {
        const cloned = res.clone();
        try {
          const errData = await cloned.json();
          const code = errData?.error?.code || errData?.detail?.code;
          const msg = errData?.error?.message || errData?.detail?.message || "Session expired";

          if (
            code === "SESSION_REPLACED" ||
            code === "ACCOUNT_EXPIRED" ||
            code === "ACCOUNT_DISABLED" ||
            code === "TOKEN_EXPIRED" ||
            code === "NOT_AUTHENTICATED"
          ) {
            useAuthStore.getState().handleAuthError(code, msg);
          }
        } catch {
          // not json
        }
        return res;
      }

      // Retry on transient server wake errors (502, 503, 504) for idempotent methods
      if (
        (res.status === 502 || res.status === 503 || res.status === 504) &&
        attempt < retries &&
        (!init.method || init.method === "GET")
      ) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries && (!init.method || init.method === "GET")) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  throw lastError || new Error("Network request failed");
}

export async function uploadSheet(file: File): Promise<SessionState> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authFetch(`${BASE_URL}/sheets/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to analyze workbook");
  }

  const data = await res.json();
  return getSession(data.session_id);
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to load session");
  }
  return res.json();
}

export async function addSlots(sessionId: string, count: number): Promise<SessionState> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/add-slots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to add design slots");
  }
  return getSession(sessionId);
}

export async function deleteDesign(sessionId: string, designId: string, force: boolean = false): Promise<SessionState> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}?force=${force}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to delete design");
  }
  return getSession(sessionId);
}

export async function saveDesignJson(sessionId: string, designId: string, rawText: string): Promise<PutJsonResponse> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}/json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
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
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}/images`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls, product_link: productLink || null, unlock }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to save image links");
  }
}

export async function saveDesignSizes(
  sessionId: string,
  designId: string,
  sizes: string[]
): Promise<{ status: string; design: any; preview_rows: PreviewRow[]; design_sizes?: string[] }> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}/sizes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sizes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to save sizes");
  }
  return res.json();
}

export async function bulkAssignJson(sessionId: string, rawText: string): Promise<BulkAssignResponse> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/bulk-assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to parse batch JSON");
  }
  return res.json();
}

export async function confirmBulkAssign(
  sessionId: string,
  pairs: { design_id: string; json_index: number; parsed_json: any }[]
): Promise<SessionState> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/bulk-assign/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairs }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to apply matched JSON");
  }
  return getSession(sessionId);
}

export async function getJsonTemplate(sessionId: string, designId: string): Promise<any> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}/json-template`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to fetch template skeleton");
  }
  return res.json();
}

export async function generateWorkbook(
  sessionId: string,
  mode: "ready_only" | "all_or_nothing"
): Promise<{ download_url: string; report: any; filename?: string }> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to generate workbook");
  }
  return res.json();
}

/**
 * Downloads the generated workbook using an authenticated request with bearer token,
 * streaming the Blob and triggering a clean client-side file save.
 */
export async function downloadWorkbookFile(
  downloadUrl: string,
  filename?: string
): Promise<void> {
  let url = downloadUrl.startsWith("http")
    ? downloadUrl
    : `${API_BASE}${downloadUrl.startsWith("/") ? downloadUrl : `/${downloadUrl}`}`;

  // Always append cache-busting timestamp parameter to prevent browser caching
  const separator = url.includes("?") ? "&" : "?";
  url = `${url}${separator}_cb=${Date.now()}`;

  const res = await authFetch(url, {
    cache: "no-store",
    headers: {
      "Pragma": "no-cache",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.detail?.message ||
        err?.error?.message ||
        `Download failed with HTTP status ${res.status}`
    );
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "Flipkart_Filled_TShirt_Sheet.xlsm";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl);
  }, 60000);
}

export async function getAllowedValues(attribute: string): Promise<string[]> {
  const res = await authFetch(`${BASE_URL}/allowed-values/${attribute}`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return data.values || [];
}

export async function saveDesignMeta(
  sessionId: string,
  designId: string,
  meta: BrandMeta
): Promise<any> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/designs/${designId}/meta`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to save brand & manufacturer details");
  }
  return res.json();
}

export async function applyMetaToAll(
  sessionId: string,
  meta: BrandMeta
): Promise<any> {
  const res = await authFetch(`${BASE_URL}/sheets/${sessionId}/meta/apply-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to apply details to all T-shirts");
  }
  return res.json();
}

export async function saveUserBrandDefaults(defaults: {
  brand?: string;
  manufacturer?: string;
  packer?: string;
  hsn?: string;
  mrp?: string | number;
  selling_price?: string | number;
  sleeve?: string;
}): Promise<any> {
  const res = await authFetch(`${BASE_URL}/auth/brand-defaults`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(defaults),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to save user brand defaults");
  }
  return res.json();
}


// --------------------------------------------------------------------------
// Admin Management API Functions
// --------------------------------------------------------------------------
export async function listAdminUsers(params: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<any> {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  if (params.page) sp.set("page", params.page.toString());
  if (params.limit) sp.set("limit", params.limit.toString());

  const res = await authFetch(`${BASE_URL}/admin/users?${sp.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to load users list");
  }
  return res.json();
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const err = await res.json();
    if (err?.error?.message) return err.error.message;
    if (typeof err?.detail === "string") return err.detail;
    if (Array.isArray(err?.detail) && err.detail.length > 0) {
      const first = err.detail[0];
      const field = first?.loc ? first.loc[first.loc.length - 1] : "Field";
      return `${field}: ${first?.msg || "Validation error"}`;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export async function createAdminUser(payload: {
  username: string;
  password: string;
  display_name?: string;
  duration_days?: number;
  notes?: string;
}): Promise<any> {
  const res = await authFetch(`${BASE_URL}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Failed to create user");
    throw new Error(msg);
  }
  return res.json();
}

export async function updateAdminUser(
  uid: string,
  payload: {
    display_name?: string;
    password?: string;
    extension?: string;
    notes?: string;
  }
): Promise<any> {
  const res = await authFetch(`${BASE_URL}/admin/users/${uid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Failed to update user");
    throw new Error(msg);
  }
  return res.json();
}

export async function disableAdminUser(uid: string): Promise<any> {
  const res = await authFetch(`${BASE_URL}/admin/users/${uid}/disable`, {
    method: "POST",
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Failed to deactivate user");
    throw new Error(msg);
  }
  return res.json();
}

export async function enableAdminUser(uid: string): Promise<any> {
  const res = await authFetch(`${BASE_URL}/admin/users/${uid}/enable`, {
    method: "POST",
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Failed to enable user");
    throw new Error(msg);
  }
  return res.json();
}

export async function forceLogoutAdminUser(uid: string): Promise<any> {
  const res = await authFetch(`${BASE_URL}/admin/users/${uid}/force-logout`, {
    method: "POST",
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Failed to force logout user");
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteAdminUser(uid: string): Promise<any> {
  const res = await authFetch(`${BASE_URL}/admin/users/${uid}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Failed to delete user");
    throw new Error(msg);
  }
  return res.json();
}

export async function getAdminStats(): Promise<any> {
  const res = await authFetch(`${BASE_URL}/admin/stats`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to load dashboard statistics");
  }
  return res.json();
}

export async function getAdminActivity(params: {
  user_id?: string;
  event?: string;
  limit?: number;
  skip?: number;
}): Promise<any> {
  const sp = new URLSearchParams();
  if (params.user_id) sp.set("user_id", params.user_id);
  if (params.event) sp.set("event", params.event);
  if (params.limit) sp.set("limit", params.limit.toString());
  if (params.skip) sp.set("skip", params.skip.toString());

  const res = await authFetch(`${BASE_URL}/admin/activity?${sp.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to load activity logs");
  }
  return res.json();
}
