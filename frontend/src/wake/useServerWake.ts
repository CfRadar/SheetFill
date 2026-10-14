import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../config";

export type WakeStatus = "checking" | "waking" | "ready" | "failed";

export interface ServerWakeState {
  status: WakeStatus;
  elapsedSeconds: number;
  retry: () => void;
}

export function useServerWake(): ServerWakeState {
  const [status, setStatus] = useState<WakeStatus>("checking");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const checkHealth = async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_BASE}/api/health`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.status === "ok") {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const startWakeCycle = useCallback(() => {
    let timer: any = null;
    let pollTimer: any = null;
    let isMounted = true;

    const run = async () => {
      const isReadyInitially = await checkHealth();
      if (!isMounted) return;

      if (isReadyInitially) {
        setStatus("ready");
        return;
      }

      setStatus("waking");
      const startTime = Date.now();

      timer = setInterval(() => {
        if (!isMounted) return;
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        setElapsedSeconds(seconds);
        if (seconds >= 120) {
          setStatus("failed");
          clearInterval(timer);
          clearTimeout(pollTimer);
        }
      }, 1000);

      const poll = async () => {
        if (!isMounted) return;
        const ready = await checkHealth();
        if (!isMounted) return;

        if (ready) {
          setStatus("ready");
          clearInterval(timer);
          clearTimeout(pollTimer);
        } else {
          pollTimer = setTimeout(poll, 2500);
        }
      };

      pollTimer = setTimeout(poll, 2000);
    };

    run();

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, []);

  useEffect(() => {
    const cleanup = startWakeCycle();
    return cleanup;
  }, [startWakeCycle]);

  const retry = useCallback(() => {
    setStatus("checking");
    setElapsedSeconds(0);
    startWakeCycle();
  }, [startWakeCycle]);

  return { status, elapsedSeconds, retry };
}
