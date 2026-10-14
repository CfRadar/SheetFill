import React, { useEffect, useState } from "react";
import { getSession } from "./api";
import { useAppStore } from "./store";
import { UploadStep } from "./components/UploadStep";
import { SummaryBar } from "./components/SummaryBar";
import { DesignCard } from "./components/DesignCard";
import { BulkPasteDialog } from "./components/BulkPasteDialog";
import { GenerateBar } from "./components/GenerateBar";
import { ReportPanel } from "./components/ReportPanel";
import { PromptDropdown } from "./components/PromptDropdown";

export const App: React.FC = () => {
  const { session, setSession, error, setError, isBulkDialogOpen, setBulkDialogOpen } = useAppStore();
  const [downloadInfo, setDownloadInfo] = useState<{ url: string; report: any; filename?: string } | null>(null);

  useEffect(() => {
    // Restore session from query param if available
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("sid");
    if (sid && !session) {
      getSession(sid)
        .then((s) => {
          setSession(s);
          if (s.download_url && s.report) {
            setDownloadInfo({ url: s.download_url, report: s.report, filename: s.output_filename || undefined });
          }
        })
        .catch((err) => {
          console.warn("Could not resume session:", err);
          params.delete("sid");
          window.history.replaceState({}, "", window.location.pathname);
        });
    }
  }, []);

  const handleGenerated = (downloadUrl: string, report: any, filename?: string) => {
    setDownloadInfo({ url: downloadUrl, report, filename });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-16">
      {/* Top action header for active session (superseded in Phase 4 by MasterDetail toolbar) */}
      {session && (
        <header className="bg-content1 border-b border-divider px-4 py-3 shadow-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tracking-tight">Active Workbook Session</span>
            </div>
            <div className="flex items-center gap-3">
              <PromptDropdown />
              <button
                type="button"
                onClick={() => {
                  if (confirm("Start a new session?")) {
                    setSession(null);
                    setDownloadInfo(null);
                    window.history.pushState({}, "", window.location.pathname);
                  }
                }}
                className="text-xs text-default-600 hover:text-foreground px-2.5 py-1.5 rounded border border-divider hover:border-default-400 transition-colors"
              >
                New sheet
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="bg-red-500 text-white text-xs py-2 px-4 shadow-sm flex items-center justify-between">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-white/80 hover:text-white font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {!session ? (
          <UploadStep />
        ) : (
          <div>
            <SummaryBar
              onOpenBulkPaste={() => setBulkDialogOpen(true)}
              onGenerateClick={() => {
                const el = document.getElementById("generate-bar");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            />

            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
              {/* Generated Report View */}
              {downloadInfo && (
                <ReportPanel
                  report={downloadInfo.report}
                  downloadUrl={downloadInfo.url}
                  filename={downloadInfo.filename}
                  onReset={() => setDownloadInfo(null)}
                />
              )}

              {/* Designs List */}
              {session.designs.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
                  <h3 className="text-base font-semibold text-slate-700 mb-1">No product designs detected</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    The uploaded sheet contains 0 data rows. Use "+ Add slots" in the top bar to create new design cards.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {session.designs.map((design, idx) => (
                    <DesignCard key={design.id} design={design} index={idx} />
                  ))}
                </div>
              )}

              {/* Generate Section */}
              <div id="generate-bar">
                <GenerateBar onGenerated={handleGenerated} />
              </div>
            </div>

            {/* Bulk Paste Modal */}
            <BulkPasteDialog
              isOpen={isBulkDialogOpen}
              onClose={() => setBulkDialogOpen(false)}
            />
          </div>
        )}
      </main>
    </div>
  );
};
