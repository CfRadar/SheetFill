import React, { useState } from "react";
import { generateWorkbook } from "../api";
import { useAppStore } from "../store";

interface GenerateBarProps {
  onGenerated: (downloadUrl: string, report: any) => void;
}

export const GenerateBar: React.FC<GenerateBarProps> = ({ onGenerated }) => {
  const { session, setSession, setError } = useAppStore();
  const [mode, setMode] = useState<"ready_only" | "all_or_nothing">("ready_only");
  const [isGenerating, setIsGenerating] = useState(false);

  if (!session) return null;

  const readyCount = session.designs.filter(
    (d) => d.status === "ready" || d.status === "complete"
  ).length;

  const handleGenerate = async () => {
    if (readyCount === 0) return;
    try {
      setIsGenerating(true);
      setError(null);
      const res = await generateWorkbook(session.session_id, mode);
      onGenerated(res.download_url, res.report);
    } catch (err: any) {
      setError(err?.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-slate-700">Generation Mode:</span>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setMode("ready_only")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              mode === "ready_only"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Only ready designs
          </button>
          <button
            type="button"
            onClick={() => setMode("all_or_nothing")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              mode === "all_or_nothing"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All or nothing
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">
          Ready: <strong className="text-slate-800">{readyCount}</strong> / {session.designs.length} designs
        </span>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={readyCount === 0 || isGenerating}
          className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Rebuilding Workbook...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Generate .xlsm
            </>
          )}
        </button>
      </div>
    </div>
  );
};
