import React, { useState } from "react";
import { bulkAssignJson, confirmBulkAssign } from "../api";
import { useAppStore } from "../store";
import { BulkAssignResponse, MatchAssignment } from "../types";

interface BulkPasteDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkPasteDialog: React.FC<BulkPasteDialogProps> = ({ isOpen, onClose }) => {
  const { session, setSession, setError } = useAppStore();
  const [rawText, setRawText] = useState("");
  const [matchResult, setMatchResult] = useState<BulkAssignResponse | null>(null);
  const [manualPairs, setManualPairs] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !session) return null;

  const handleMatch = async () => {
    if (!rawText.trim()) return;
    try {
      setIsProcessing(true);
      const res = await bulkAssignJson(session.session_id, rawText);
      setMatchResult(res);
      // Prepopulate manual assignments for unmatched
      const initManual: Record<number, string> = {};
      setManualPairs(initManual);
    } catch (err: any) {
      setError(err?.message || "Failed to process bulk JSON");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!matchResult) return;
    try {
      setIsProcessing(true);
      const pairs: { design_id: string; json_index: number; parsed_json: any }[] = [];

      // 1. Confirmed assigned
      for (const a of matchResult.assigned) {
        pairs.push({
          design_id: a.design_id,
          json_index: a.json_index,
          parsed_json: a.parsed_json,
        });
      }

      // 2. Manual pairs
      for (const [jIdxStr, did] of Object.entries(manualPairs)) {
        if (did) {
          const jIdx = parseInt(jIdxStr);
          const unmatchedObj = matchResult.unmatched_json.find((u) => u.json_index === jIdx);
          if (unmatchedObj) {
            pairs.push({
              design_id: did,
              json_index: jIdx,
              parsed_json: unmatchedObj.parsed_json,
            });
          }
        }
      }

      const updated = await confirmBulkAssign(session.session_id, pairs);
      setSession(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to apply matched JSON");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800">Paste All Product JSONs</h3>
            <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
              Multi-Design Matching
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {!matchResult ? (
            <div>
              <p className="text-xs text-slate-500 mb-2">
                Paste a JSON array <code>[&#123;...&#125;, &#123;...&#125;]</code> or several JSON objects pasted back-to-back.
                The matcher will automatically correlate them with the detected designs by SKU base, title, or style code.
              </p>
              <textarea
                data-testid="bulk-json-textarea"
                rows={14}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder='[\n  {\n    "sku_base": "tintin_os",\n    "product_title": "...",\n    ...\n  },\n  ...\n]'
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  Matching Results ({matchResult.assigned.length} matched, {matchResult.unmatched_json.length} unmatched JSONs)
                </span>
                <button
                  type="button"
                  onClick={() => setMatchResult(null)}
                  className="text-blue-600 hover:underline"
                >
                  Edit raw JSON
                </button>
              </div>

              {/* Assignments Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">JSON Title / Base</th>
                      <th className="p-2.5">Matched Design Slot</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {matchResult.assigned.map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-medium text-slate-800">
                          {a.json_base || a.parsed_json?.product_title || `#${a.json_index + 1}`}
                        </td>
                        <td className="p-2.5 font-bold text-blue-700">
                          {a.design_base || a.design_id}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              a.how === "exact"
                                ? "bg-emerald-100 text-emerald-800"
                                : a.how === "normalized" || a.how === "suffix"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {a.how}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-500">
                          {Math.round(a.confidence * 100)}%
                        </td>
                      </tr>
                    ))}

                    {/* Unmatched JSON items */}
                    {matchResult.unmatched_json.map((u) => (
                      <tr key={u.json_index} className="bg-red-50/30">
                        <td className="p-2.5 font-medium text-red-800">
                          {u.parsed_json?.sku_base || u.parsed_json?.product_title || `JSON #${u.json_index + 1}`}
                        </td>
                        <td className="p-2.5" colSpan={3}>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-red-600 font-medium">Unmatched. Assign to:</span>
                            <select
                              value={manualPairs[u.json_index] || ""}
                              onChange={(e) =>
                                setManualPairs({
                                  ...manualPairs,
                                  [u.json_index]: e.target.value,
                                })
                              }
                              className="text-xs p-1 rounded border border-slate-300 bg-white"
                            >
                              <option value="">-- Choose Design Slot --</option>
                              {session.designs.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.id}: {d.base || "Unnamed"}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          {!matchResult ? (
            <button
              type="button"
              onClick={handleMatch}
              disabled={isProcessing || !rawText.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isProcessing ? "Matching..." : "Match JSONs to Designs"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isProcessing ? "Applying..." : "Confirm & Save All"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
