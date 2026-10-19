import React, { useState } from "react";
import { deleteDesign, saveDesignImages, saveDesignSizes } from "../api";
import { useAppStore } from "../store";
import { DetectedDesign, PreviewRow } from "../types";
import { ImageLinksEditor } from "./ImageLinksEditor";
import { JsonEditor } from "./JsonEditor";
import { RowsPreview } from "./RowsPreview";

interface DesignCardProps {
  design: DetectedDesign;
  index: number;
}

const BRAND_SIZES = ["S", "M", "L", "XL", "XS", "XXL", "3XL", "4XL", "5XL", "Free"];

export const DesignCard: React.FC<DesignCardProps> = ({ design, index }) => {
  const { session, setSession, expandedDesigns, toggleDesignExpanded, setError } = useAppStore();
  const isExpanded =
    expandedDesigns && expandedDesigns[design.id] !== undefined
      ? expandedDesigns[design.id]
      : design.status !== "complete";

  const [sizes, setSizes] = useState<string[]>(
    session?.design_sizes?.[design.id] ||
      (design.sizes_found && design.sizes_found.length > 0
        ? design.sizes_found
        : ["S", "M", "L", "XL"])
  );
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const initialJsonText = session?.design_raw_text?.[design.id] || "";

  const handleToggleSize = async (size: string) => {
    const next = sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size];
    if (next.length === 0) return; // Must have at least 1 size
    setSizes(next);
    if (session) {
      await saveDesignSizes(session.session_id, design.id, next);
    }
  };

  const handleSaveImages = async (
    urls: (string | null)[],
    productLink?: string | null,
    unlock: boolean = false
  ) => {
    if (session) {
      await saveDesignImages(session.session_id, design.id, urls, productLink, unlock);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    try {
      const updated = await deleteDesign(session.session_id, design.id, true);
      setSession(updated);
    } catch (err: any) {
      setError(err?.message || "Failed to delete design");
    }
  };

  const getStatusBadge = () => {
    switch (design.status) {
      case "complete":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Complete</span>;
      case "ready":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">Ready</span>;
      case "invalid":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">Invalid</span>;
      case "blocked":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-300">Blocked</span>;
      case "partial":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">Partial</span>;
      case "needs_json":
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Needs JSON</span>;
    }
  };

  const sheetRowsStr = design.sheet_rows.length > 1
    ? `rows ${design.sheet_rows[0]}..${design.sheet_rows[design.sheet_rows.length - 1]}`
    : design.sheet_rows.length === 1
    ? `row ${design.sheet_rows[0]}`
    : "manual slot";

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <div
        onClick={() => toggleDesignExpanded(design.id)}
        className="px-4 py-3 bg-white hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-4 border-b border-slate-100 select-none"
      >
        <div className="flex items-center gap-3">
          {/* Main image thumbnail */}
          <div className="w-10 h-10 bg-slate-100 rounded-md border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {design.main_image_url ? (
              <img
                src={design.main_image_url}
                alt="thumb"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-slate-400 text-xs font-bold">#{index + 1}</span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">
                #{index + 1} {design.base || <span className="italic font-normal text-slate-400">Unnamed stub</span>}
              </span>
              <span className="text-xs text-slate-400 font-mono">({sheetRowsStr})</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>{sizes.length} sizes ({sizes.join(", ")})</span>
              <span>•</span>
              <span>{design.image_urls.filter(Boolean).length}/7 images</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-5 space-y-5 border-t border-slate-100 bg-slate-50/30">
          {/* Complete Banner if status is complete */}
          {design.status === "complete" && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
              <span>This design was uploaded as complete (4 size rows with prices & description).</span>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Reset this design to edit its data with JSON?")) {
                    design.status = "needs_json";
                    toggleDesignExpanded(design.id);
                  }
                }}
                className="px-2 py-1 bg-white border border-emerald-300 rounded font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Re-do this design
              </button>
            </div>
          )}

          {/* Sizes Selection */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">Select Brand Sizes to Generate</span>
              <span className="text-xs text-blue-600 font-medium">Will create {sizes.length} rows</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {BRAND_SIZES.map((s) => {
                const checked = sizes.includes(s);
                return (
                  <label
                    key={s}
                    className={`px-3 py-1 text-xs rounded-md font-semibold border cursor-pointer transition-colors ${
                      checked
                        ? "bg-blue-50 border-blue-400 text-blue-800"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={checked}
                      onChange={() => handleToggleSize(s)}
                    />
                    {s}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Image Links Editor */}
          <ImageLinksEditor
            imageUrls={session?.design_image_edits?.[design.id] || design.image_urls}
            productLink={session?.design_product_links?.[design.id] ?? design.product_link}
            isManualSlot={design.is_manual_slot}
            onSave={handleSaveImages}
          />


          {/* JSON Editor */}
          {session && (
            <JsonEditor
              sessionId={session.session_id}
              designId={design.id}
              initialText={initialJsonText}
              onValidated={(res) => {
                setPreviewRows(res.preview_rows);
                design.status = res.status;
              }}
            />
          )}

          {/* Row Preview Table */}
          {previewRows.length > 0 && <RowsPreview rows={previewRows} />}

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Remove this design slot?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-2 py-0.5 text-xs bg-red-600 text-white rounded font-medium hover:bg-red-700"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-0.5 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-slate-400 hover:text-red-600 transition-colors"
              >
                Delete design slot
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleDesignExpanded(design.id)}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              Done editing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
