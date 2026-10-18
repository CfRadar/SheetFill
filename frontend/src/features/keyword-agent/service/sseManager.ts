import { connectSSE, cancelRun as apiCancelRun } from "../api";
import type { SSEEvent } from "../types";

class SSEManager {
  private activeRunId: string | null = null;
  private cleanupFn: (() => void) | null = null;

  public getActiveRunId(): string | null {
    return this.activeRunId;
  }

  public isStreaming(runId: string): boolean {
    return this.activeRunId === runId;
  }

  public startStream(
    runId: string,
    onEvent: (event: SSEEvent) => void,
    onError: (err: any) => void,
    onDone: () => void
  ): void {
    // If already streaming for this run, do not duplicate
    if (this.activeRunId === runId && this.cleanupFn) {
      return;
    }

    // Abort any existing stream
    this.stopStream();

    this.activeRunId = runId;
    this.cleanupFn = connectSSE(
      runId,
      (event: SSEEvent) => {
        onEvent(event);
      },
      (err: any) => {
        onError(err);
        this.stopStream();
      },
      () => {
        onDone();
        this.stopStream();
      }
    );
  }

  public stopStream(): void {
    if (this.cleanupFn) {
      try {
        this.cleanupFn();
      } catch (e) {
        console.warn("Error stopping SSE stream:", e);
      }
      this.cleanupFn = null;
    }
    this.activeRunId = null;
  }

  public async cancelAndStop(runId: string): Promise<void> {
    this.stopStream();
    try {
      await apiCancelRun(runId);
    } catch (e) {
      console.warn("Failed to cancel run on backend:", e);
    }
  }
}

export const sseManager = new SSEManager();
