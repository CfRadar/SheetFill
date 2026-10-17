import React, { useState, useEffect } from "react";
import { applyMetaToAll, saveDesignMeta } from "../api";
import { useAppStore } from "../store";
import { BrandMeta, DetectedDesign, PreviewRow } from "../types";

interface BrandMetaEditorProps {
  sessionId: string;
  design: DetectedDesign;
  onMetaUpdated?: (meta: BrandMeta, previewRows?: PreviewRow[]) => void;
}

const HSN_PRESETS = [
  { code: "610910", label: "610910 (Cotton T-shirts - Recommended)" },
  { code: "61091000", label: "61091000 (8-digit Cotton T-shirts)" },
  { code: "61099010", label: "61099010 (Blends & Synthetic T-shirts)" },
  { code: "6109", label: "6109 (General 4-digit heading)" },
];

export const BrandMetaEditor: React.FC<BrandMetaEditorProps> = ({
  sessionId,
  design,
  onMetaUpdated,
}) => {
  const { session, setSession, setError } = useAppStore();

  const currentMeta = session?.design_meta?.[design.id] || session?.global_meta || {};

  const initialHsn =
    currentMeta.hsn ||
    (() => {
      const existY = strClean(design.existing_values?.["Y"]);
      return existY && !isNaN(Number(existY)) ? existY : "610910";
    })();

  const initialBrand =
    currentMeta.brand ||
    strClean(design.existing_values?.["AG"]) ||
    "fashion continental";

  const initialManufacturer =
    currentMeta.manufacturer ||
    strClean(design.existing_values?.["AB"]) ||
    "fashion continental";

  const [hsn, setHsn] = useState<string>(initialHsn);
  const [brand, setBrand] = useState<string>(initialBrand);
  const [manufacturer, setManufacturer] = useState<string>(initialManufacturer);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    const meta = session?.design_meta?.[design.id] || session?.global_meta;
    if (meta) {
      if (meta.hsn !== undefined) setHsn(meta.hsn);
      if (meta.brand !== undefined) setBrand(meta.brand);
      if (meta.manufacturer !== undefined) setManufacturer(meta.manufacturer);
    }
  }, [session?.design_meta, session?.global_meta, design.id]);

  function strClean(val: any): string {
    return val !== undefined && val !== null ? String(val).trim() : "";
  }

  const handleSaveCurrent = async () => {
    setIsSaving(true);
    setSavedNotice(null);
    try {
      const res = await saveDesignMeta(sessionId, design.id, {
        hsn: hsn.trim(),
        brand: brand.trim(),
        manufacturer: manufacturer.trim(),
      });
      if (session) {
        const nextMeta = { ...(session.design_meta || {}) };
        nextMeta[design.id] = {
          hsn: hsn.trim(),
          brand: brand.trim(),
          manufacturer: manufacturer.trim(),
        };
        setSession({ ...session, design_meta: nextMeta });
      }
      if (onMetaUpdated) {
        onMetaUpdated(
          { hsn: hsn.trim(), brand: brand.trim(), manufacturer: manufacturer.trim() },
          res?.preview_rows
        );
      }
      setSavedNotice("Saved for this T-shirt!");
      setTimeout(() => setSavedNotice(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to save details");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyAll = async () => {
    if (
      !confirm(
        `Apply Brand: "${brand.trim()}", Manufacturer: "${manufacturer.trim()}", and HSN: "${hsn.trim()}" to ALL ${
          session?.designs.length || 0
        } T-shirts in this sheet?`
      )
    ) {
      return;
    }
    setIsApplyingAll(true);
    setSavedNotice(null);
    try {
      const res = await applyMetaToAll(sessionId, {
        hsn: hsn.trim(),
        brand: brand.trim(),
        manufacturer: manufacturer.trim(),
      });
      if (session) {
        setSession({
          ...session,
          global_meta: res.global_meta,
          design_meta: res.design_meta,
          designs: res.designs || session.designs,
          summary: res.summary || session.summary,
        });
      }
      setSavedNotice("⚡ Successfully applied to ALL T-shirts in the sheet!");
      setTimeout(() => setSavedNotice(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to apply to all T-shirts");
    } finally {
      setIsApplyingAll(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            Brand, Manufacturer & HSN Code
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            (Cols Y, AB, AG)
          </span>
        </div>

        {savedNotice && (
          <span className="text-xs font-semibold text-emerald-600 animate-pulse bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {savedNotice}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* HSN Code (Col Y) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>HSN Number (Col Y)</span>
            <span className="text-[10px] text-slate-400 font-normal">Flipkart GST</span>
          </label>
          <input
            type="text"
            value={hsn}
            onChange={(e) => setHsn(e.target.value)}
            placeholder="61091000"
            className="w-full text-xs px-2.5 py-1.5 font-mono border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {HSN_PRESETS.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setHsn(p.code)}
                title={p.label}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  hsn === p.code
                    ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {p.code}
              </button>
            ))}
          </div>
        </div>

        {/* Brand (Col AG) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>Brand (Col AG)</span>
            <span className="text-[10px] text-slate-400 font-normal">Sheet column AG</span>
          </label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="fashion continental"
            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Registered brand name for Flipkart listing.
          </p>
        </div>

        {/* Manufacturer Details (Col AB) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>Manufacturer Details (Col AB)</span>
            <span className="text-[10px] text-slate-400 font-normal">Sheet column AB</span>
          </label>
          <input
            type="text"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="fashion continental"
            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Name and location or address of manufacturer.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <span className="text-[11px] text-slate-500">
          Edit for this T-shirt or apply across the entire catalog.
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveCurrent}
            disabled={isSaving || isApplyingAll}
            className="px-3 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save for this T-shirt"}
          </button>

          <button
            type="button"
            onClick={handleApplyAll}
            disabled={isSaving || isApplyingAll}
            className="px-3 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg
              className="w-3.5 h-3.5 text-amber-300"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                clipRule="evenodd"
              />
            </svg>
            {isApplyingAll ? "Applying..." : "Implement same in all"}
          </button>
        </div>
      </div>
    </div>
  );
};
