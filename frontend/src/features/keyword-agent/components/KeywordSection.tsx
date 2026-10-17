import React, { useState } from "react";
import { Button, Input, Chip } from "@heroui/react";
import { Copy, Check, Search, Tag, Sparkles } from "lucide-react";

interface Props {
  keywords: string[];
  platformTitle: string;
}

export const KeywordSection: React.FC<Props> = ({ keywords, platformTitle }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [filterText, setFilterText] = useState("");

  const filtered = keywords.filter((k) =>
    k.toLowerCase().includes(filterText.toLowerCase().trim())
  );

  const handleCopySingle = async (kw: string, index: number) => {
    try {
      await navigator.clipboard.writeText(kw);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch (e) {
      console.warn("Could not copy keyword:", e);
    }
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(keywords.join(", "));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (e) {
      console.warn("Could not copy all keywords:", e);
    }
  };

  if (!keywords || keywords.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-dashed border-divider text-center text-xs text-default-400">
        No keywords generated for {platformTitle}.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with count, search and copy all */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-semibold text-foreground tracking-tight">
            Ranked Keywords ({keywords.length})
          </h4>
          <span className="text-[11px] text-default-400">
            5-factor scored: suggest + titles + reviews + social
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Input
            size="sm"
            placeholder="Filter keywords..."
            startContent={<Search className="w-3.5 h-3.5 text-default-400" />}
            value={filterText}
            onValueChange={setFilterText}
            classNames={{ inputWrapper: "h-7 w-36 sm:w-44 text-xs" }}
            isClearable
            onClear={() => setFilterText("")}
          />
          <Button
            size="sm"
            variant={copiedAll ? "solid" : "flat"}
            color={copiedAll ? "success" : "default"}
            className="h-7 text-xs px-2.5 font-medium gap-1 shrink-0"
            onPress={handleCopyAll}
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>All Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All ({keywords.length})</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Keywords Chips */}
      <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-content2/30 border border-divider/60 max-h-56 overflow-y-auto">
        {filtered.map((kw, idx) => {
          const isCopied = copiedIndex === idx;
          const isTopTier = idx < 5;
          return (
            <button
              key={`${kw}-${idx}`}
              type="button"
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all border text-left select-none ${
                isCopied
                  ? "bg-success-100 border-success-300 text-success-800 dark:bg-success-950/60 dark:text-success-300"
                  : isTopTier
                  ? "bg-primary-50/70 border-primary-200 text-primary-900 dark:bg-primary-950/30 dark:border-primary-800 dark:text-primary-200 hover:border-primary-400"
                  : "bg-content1 border-divider/80 text-foreground hover:border-default-400"
              }`}
              onClick={() => handleCopySingle(kw, idx)}
              title="Click to copy"
            >
              <span
                className={`text-[9px] font-mono px-1 rounded ${
                  isTopTier
                    ? "bg-primary/20 text-primary font-bold"
                    : "bg-default-200/60 text-default-500"
                }`}
              >
                #{idx + 1}
              </span>
              <span className="font-medium text-xs">{kw}</span>
              {isCopied ? (
                <Check className="w-3 h-3 text-success shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-default-300 group-hover:text-default-600 transition-colors shrink-0" />
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-xs text-default-400 py-2 w-full text-center">
            No keywords match "{filterText}".
          </div>
        )}
      </div>
    </div>
  );
};
