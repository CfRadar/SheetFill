import React, { useEffect } from "react";
import { getSession } from "./api";
import { useAppStore } from "./store";
import { UploadStep } from "./components/UploadStep";
import { Workspace } from "./workspace/Workspace";

export const App: React.FC = () => {
  const { session, setSession } = useAppStore();

  useEffect(() => {
    // Restore session from query param if available
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("sid");
    if (sid && !session) {
      getSession(sid)
        .then((s) => {
          setSession(s);
        })
        .catch((err) => {
          console.warn("Could not resume session:", err);
          params.delete("sid");
          window.history.replaceState({}, "", window.location.pathname);
        });
    }
  }, [session, setSession]);

  const handleNewSheet = () => {
    setSession(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("sid");
    window.history.replaceState({}, "", url.pathname);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <main className="flex-1 flex flex-col">
        {!session ? <UploadStep /> : <Workspace onNewSheet={handleNewSheet} />}
      </main>
    </div>
  );
};
