import React, { useState } from "react";
import { PreviewRow } from "../types";

interface RowsPreviewProps {
  rows: PreviewRow[];
}

export const RowsPreview: React.FC<RowsPreviewProps> = ({ rows }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between font-medium text-slate-700 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>Row Preview ({rows.length} size rows to write)</span>
          <span className="text-[10px] text-slate-500 font-normal">
            Highlighted columns differ per size
          </span>
        </span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="p-2 border-r border-slate-200">Size (AR)</th>
                <th className="p-2 border-r border-slate-200 bg-blue-50/70 text-blue-900">Seller SKU ID (G)</th>
                <th className="p-2 border-r border-slate-200">Neck (AH)</th>
                <th className="p-2 border-r border-slate-200">Sleeve (AL)</th>
                <th className="p-2 border-r border-slate-200">Color (AS)</th>
                <th className="p-2 border-r border-slate-200">Fabric (AJ)</th>
                <th className="p-2 border-r border-slate-200">MRP (K)</th>
                <th className="p-2 border-r border-slate-200">Price (L)</th>
                <th className="p-2">Detail Placement (BD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 font-bold text-slate-800 border-r border-slate-200 bg-amber-50/30">
                    {row.cells["AR"] || row.size}
                  </td>
                  <td className="p-2 font-mono text-blue-700 font-semibold border-r border-slate-200 bg-blue-50/40">
                    {row.cells["G"]}
                  </td>
                  <td className="p-2 border-r border-slate-200">{row.cells["AH"]}</td>
                  <td className="p-2 border-r border-slate-200">{row.cells["AL"]}</td>
                  <td className="p-2 border-r border-slate-200">{row.cells["AS"]}</td>
                  <td className="p-2 border-r border-slate-200">{row.cells["AJ"]}</td>
                  <td className="p-2 border-r border-slate-200">₹{row.cells["K"]}</td>
                  <td className="p-2 border-r border-slate-200 font-medium">₹{row.cells["L"]}</td>
                  <td className="p-2 text-slate-500 font-mono text-[11px]">
                    {row.cells["BD"] || <span className="text-slate-300 italic">None</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
