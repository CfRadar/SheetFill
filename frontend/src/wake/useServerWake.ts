import { useEffect, useState } from "react";

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
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("/api/health", {
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

  useEffect(() => {
    let timer: any = null;
    let pollTimer: any = null;
    let isMounted = true;

    const startWakeCycle = async () => {
      const isReadyInitially = await checkHealth();
      if (!isMounted) return;

      if (isReadyInitially) {
        setStatus("ready");
        return;
      }

      // If initial check fails, mark as waking and start timer
      setStatus("waking");
      const startTime = Date.now();

      timer = setInterval(() => {
        if (!isMounted) return;
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        setElapsedSeconds(seconds);
        if (seconds > 100) {
          setStatus("failed");
        }
      }, 1000);

      const poll = async () => {
        if (!isMounted) return;
        const ready = await checkHealth();
        if (!isMounted) return;

        if (ready) {
          setStatus("ready");
          clearInterval(timer);
          clearInterval(pollTimer);
        } else {
          pollTimer = setTimeout(poll, 3000);
        }
      };

      pollTimer = setTimeout(poll, 2500);
    };

    startWakeCycle();

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, []);

  const retry = () => {
    setStatus("checking");
    setElapsedSeconds(0);
    window.location.reload();
  };

  return { status, elapsedSeconds, retry };
}
