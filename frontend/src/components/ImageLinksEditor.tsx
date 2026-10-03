import React, { useState } from "react";

interface ImageLinksEditorProps {
  imageUrls: (string | null)[];
  productLink: string | null;
  isManualSlot?: boolean;
  onSave: (urls: (string | null)[], productLink?: string | null, unlock?: boolean) => void;
}

const SLOT_NAMES = [
  { col: "AU", label: "Main Image (AU)" },
  { col: "AV", label: "Other 1 (AV)" },
  { col: "AW", label: "Other 2 (AW)" },
  { col: "AX", label: "Other 3 (AX)" },
  { col: "AY", label: "Other 4 (AY)" },
  { col: "AZ", label: "Other 5 (AZ)" },
  { col: "BA", label: "Other 6 (BA)" },
];

export const ImageLinksEditor: React.FC<ImageLinksEditorProps> = ({
  imageUrls,
  productLink,
  isManualSlot = false,
  onSave,
}) => {
  const [urls, setUrls] = useState<string[]>(() => {
    const list = [...imageUrls];
    while (list.length < 7) list.push("");
    return list.map((u) => u || "");
  });
  const [pLink, setPLink] = useState<string>(productLink || "");
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  const isReadOnly = !isManualSlot && !unlocked;

  const handleUrlChange = (idx: number, val: string) => {
    const next = [...urls];
    next[idx] = val;
    setUrls(next);
    onSave(
      next.map((u) => u.trim() || null),
      pLink.trim() || null,
      unlocked
    );
  };

  const handleProductLinkChange = (val: string) => {
    setPLink(val);
    onSave(
      urls.map((u) => u.trim() || null),
      val.trim() || null,
      unlocked
    );
  };

  const handleToggleUnlock = () => {
    const nextUnlocked = !unlocked;
    setUnlocked(nextUnlocked);
    if (!nextUnlocked) {
      // Revert to original sheet images if locking back
      const orig = [...imageUrls];
      while (orig.length < 7) orig.push("");
      setUrls(orig.map((u) => u || ""));
      onSave(imageUrls, productLink, false);
    }
  };

  return (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
      <div className="space-y-3">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">Flipkart Image URLs (AU..BA)</span>
            {!isManualSlot && (
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                From your sheet
              </span>
            )}
            {isManualSlot && (
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                Manual Slot
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 font-medium italic">
              Copied from your sheet to all size rows
            </span>

            {!isManualSlot && (
              <button
                type="button"
                onClick={handleToggleUnlock}
                className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-colors ${
                  unlocked
                    ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {unlocked ? "Lock" : "Unlock to edit"}
              </button>
            )}
          </div>
        </div>

        {/* Read-only chips view for sheet-derived designs when locked */}
        {isReadOnly ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {urls.map((url, idx) => {
              const trimmed = url.trim();
              const hasUrl = Boolean(trimmed);
              const hasError = imgErrors[idx];

              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-md p-1.5 flex flex-col items-center text-center shadow-xs"
                >
                  <div className="w-full h-16 bg-slate-100 rounded overflow-hidden flex items-center justify-center relative mb-1">
                    {hasUrl && !hasError ? (
                      <img
                        src={trimmed}
                        alt={SLOT_NAMES[idx].label}
                        referrerPolicy="no-referrer"
                        onError={() => setImgErrors((prev) => ({ ...prev, [idx]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-400 p-1">
                        {hasUrl ? "No preview" : "Empty"}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">{SLOT_NAMES[idx].col}</span>
                  <span className="text-[9px] text-slate-400 truncate w-full" title={trimmed || "Empty slot"}>
                    {trimmed ? trimmed.substring(0, 15) + "..." : "Empty slot"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Editable inputs view for manual slots or unlocked sheet designs */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {urls.map((url, idx) => {
              const label = SLOT_NAMES[idx].label;
              const isInvalid = url.trim() && !url.trim().startsWith("https://");
              return (
                <div key={idx} className="flex flex-col">
                  <label className="text-[10px] font-medium text-slate-500 mb-0.5">{label}</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => handleUrlChange(idx, e.target.value)}
                    placeholder="https://..."
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      isInvalid ? "border-red-400 bg-red-50 text-red-700" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Product Link (Col D) */}
        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <label className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
            Flipkart Product Link (Col D):
          </label>
          {isReadOnly ? (
            <span className="text-xs text-slate-600 truncate max-w-lg font-mono">
              {pLink || <span className="italic text-slate-400">None in sheet</span>}
            </span>
          ) : (
            <input
              type="text"
              value={pLink}
              onChange={(e) => handleProductLinkChange(e.target.value)}
              placeholder="https://www.flipkart.com/..."
              className="flex-1 w-full px-2 py-1 text-xs rounded border border-slate-300 focus:border-blue-500"
            />
          )}
        </div>
      </div>
    </div>
  );
};
