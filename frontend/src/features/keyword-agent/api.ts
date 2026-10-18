import { authFetch, API_BASE } from "../../api";
import type { ChatResponse, KeyStatus, MultiKeyItem, ProductBrief, RunResult, SSEEvent } from "./types";

const KEYWORD_BASE = `${API_BASE}/api/keyword-agent`;


export async function getKeyStatus(): Promise<KeyStatus> {
  const res = await authFetch(`${KEYWORD_BASE}/settings/openrouter-key`);
  if (!res.ok) {
    throw new Error(`Failed to load key status: HTTP ${res.status}`);
  }
  return res.json();
}

export async function saveKey(apiKey: string, preferredModel?: string): Promise<KeyStatus> {
  const res = await authFetch(`${KEYWORD_BASE}/settings/openrouter-key`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, preferred_model: preferredModel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.message || err?.message || "Failed to save API key.");
  }
  return res.json();
}

export async function deleteKey(): Promise<void> {
  const res = await authFetch(`${KEYWORD_BASE}/settings/openrouter-key`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to remove key: HTTP ${res.status}`);
  }
}

export async function listUserKeys(): Promise<MultiKeyItem[]> {
  const res = await authFetch(`${KEYWORD_BASE}/keys`);
  if (!res.ok) {
    throw new Error(`Failed to list keys: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.keys || [];
}

export async function addUserKey(apiKey: string, label?: string): Promise<MultiKeyItem> {
  const res = await authFetch(`${KEYWORD_BASE}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, label: label || "Personal Key" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.message || err?.message || "Failed to add API key.");
  }
  return res.json();
}

export async function deleteUserKey(keyId: string): Promise<void> {
  const res = await authFetch(`${KEYWORD_BASE}/keys/${encodeURIComponent(keyId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete key: HTTP ${res.status}`);
  }
}

export async function testKey(apiKey?: string): Promise<any> {
  const res = await authFetch(`${KEYWORD_BASE}/settings/openrouter-key/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.message || err?.message || "Key test failed.");
  }
  return res.json();
}

export async function getModels(): Promise<{ default: string; allowed_models: string[] }> {
  const res = await authFetch(`${KEYWORD_BASE}/models`);
  if (!res.ok) {
    return {
      default: "meta-llama/llama-3.3-70b-instruct",
      allowed_models: [
        "meta-llama/llama-3.3-70b-instruct",
        "openai/gpt-4o-mini",
        "deepseek/deepseek-chat",
        "anthropic/claude-3.5-haiku",
        "meta-llama/llama-3.2-3b-instruct:free",
        "mistralai/mistral-small-24b-instruct-2501",
      ],
    };
  }
  return res.json();
}

export async function createRun(brief: ProductBrief): Promise<{ run_id: string }> {
  const res = await authFetch(`${KEYWORD_BASE}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(brief),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const code = err?.detail?.code || err?.code;
    const msg = err?.detail?.message || err?.message || "Failed to create run.";
    const error: any = new Error(msg);
    error.code = code;
    throw error;
  }
  return res.json();
}

export async function getRun(runId: string): Promise<any> {
  const res = await authFetch(`${KEYWORD_BASE}/runs/${encodeURIComponent(runId)}`);
  if (!res.ok) {
    throw new Error(`Failed to load run: HTTP ${res.status}`);
  }
  return res.json();
}

export async function cancelRun(runId: string): Promise<void> {
  await authFetch(`${KEYWORD_BASE}/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
  });
}

export async function chatRefine(runId: string, message: string): Promise<ChatResponse> {
  const res = await authFetch(`${KEYWORD_BASE}/runs/${encodeURIComponent(runId)}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.message || err?.message || "Chat refinement failed.");
  }
  return res.json();
}

export async function getPreflight(): Promise<any> {
  const res = await authFetch(`${KEYWORD_BASE}/system/preflight`);
  if (!res.ok) {
    throw new Error("System preflight check failed.");
  }
  return res.json();
}

export function connectSSE(
  runId: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (err: any) => void,
  onDone?: () => void
): () => void {
  const abortController = new AbortController();
  let isClosed = false;

  async function startStream() {
    if (isClosed || abortController.signal.aborted) return;

    try {
      const response = await authFetch(
        `${KEYWORD_BASE}/runs/${encodeURIComponent(runId)}/events`,
        { signal: abortController.signal }
      );

      if (!response.ok) {
        throw new Error(`SSE stream failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body available for SSE streaming.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (!isClosed && !abortController.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const lines = block.split(/\r?\n/);
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("data:")) {
              dataStr += line.slice(5).trim();
            }
          }

          if (dataStr) {
            try {
              const parsed: SSEEvent = JSON.parse(dataStr);
              onEvent(parsed);
              if (parsed.type === "done") {
                isClosed = true;
                if (onDone) onDone();
                return;
              }
              if (parsed.type === "error") {
                isClosed = true;
                if (onError) onError(new Error(parsed.message || "Pipeline error"));
                return;
              }
            } catch {
              // Ignore ping or unparseable keep-alives
            }
          }
        }
      }
    } catch (err: any) {
      if (abortController.signal.aborted || isClosed) return;
      isClosed = true;
      if (onError) onError(err);
    }
  }

  startStream();

  return () => {
    isClosed = true;
    abortController.abort();
  };
}
