import React, { useState } from "react";
import { addSlots } from "../api";
import { useAppStore } from "../store";

interface SummaryBarProps {
  onOpenBulkPaste: () => void;
  onGenerateClick: () => void;
}

export const SummaryBar: React.FC<SummaryBarProps> = ({
  onOpenBulkPaste,
  onGenerateClick,
}) => {
  const { session, setSession, setLoading, setError } = useAppStore();
  const [slotCount, setSlotCount] = useState<number>(1);
  const [isAdding, setIsAdding] = useState(false);

  if (!session) return null;

  const { summary, designs } = session;
  const readyCount = designs.filter((d) => d.status === "ready" || d.status === "complete").length;

  const handleAddSlots = async () => {
    if (slotCount < 1) return;
    try {
      setIsAdding(true);
      const updated = await addSlots(session.session_id, slotCount);
      setSession(updated);
    } catch (err: any) {
      setError(err?.message || "Failed to add slots");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Counts & Status */}
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {session.filename}
            </div>
            <div className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>{summary.total} designs found</span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-600 font-semibold">{summary.needs_json} need JSON</span>
              {summary.partial > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-orange-500">{summary.partial} partial</span>
                </>
              )}
              {summary.complete > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-600 font-semibold">{summary.complete} complete</span>
                </>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200">
            <div className="text-sm font-medium text-slate-600">
              Progress: <span className="font-bold text-blue-600">{readyCount}</span> of {summary.total} ready
            </div>
            <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${summary.total > 0 ? (readyCount / summary.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenBulkPaste}
            className="px-3.5 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Paste all JSON
          </button>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            <input
              type="number"
              min={1}
              max={summary.room_for_new_designs || 10}
              value={slotCount}
              onChange={(e) => setSlotCount(parseInt(e.target.value) || 1)}
              className="w-12 px-1.5 py-1 text-xs text-center border-0 bg-transparent font-medium focus:ring-0"
            />
            <button
              onClick={handleAddSlots}
              disabled={isAdding}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded transition-colors"
            >
              + Add slots
            </button>
          </div>

          <button
            onClick={onGenerateClick}
            disabled={readyCount === 0}
            className={`px-4 py-1.5 text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 ${
              readyCount > 0
                ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Generate .xls
          </button>
        </div>
      </div>
    </div>
  );
};
