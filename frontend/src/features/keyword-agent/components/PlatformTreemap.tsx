import React from "react";
import type { PlatformName, PlatformResult } from "../types";

interface PlatformTreemapProps {
  platforms: PlatformResult[];
  activePlatform: PlatformName;
  onSelectPlatform: (platform: PlatformName) => void;
}

const PLATFORM_COLORS: Record<PlatformName, { bg: string; border: string; text: string; fill: string }> = {
  amazon: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    border: "border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    fill: "#f59e0b",
  },
  flipkart: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    border: "border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
    fill: "#3b82f6",
  },
  myntra: {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    border: "border-rose-500/30",
    text: "text-rose-600 dark:text-rose-400",
    fill: "#f43f5e",
  },
  meesho: {
    bg: "bg-pink-500/10 dark:bg-pink-500/20",
    border: "border-pink-500/30",
    text: "text-pink-600 dark:text-pink-400",
    fill: "#ec4899",
  },
};

const PLATFORM_LABELS: Record<PlatformName, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  meesho: "Meesho",
};

export const PlatformTreemap: React.FC<PlatformTreemapProps> = ({
  platforms,
  activePlatform,
  onSelectPlatform,
}) => {
  const totalKeywords = platforms.reduce((acc, p) => acc + (p.keywords?.length || 1), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
        <span>Marketplace Share & Keyword Depth</span>
        <span className="text-[11px] text-default-400 font-normal">
          {totalKeywords} Total Keywords Mapped
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 h-20">
        {platforms.map((p) => {
          const count = p.keywords?.length || 0;
          const share = totalKeywords > 0 ? Math.round((count / totalKeywords) * 100) : 25;
          const isSelected = p.platform === activePlatform;
          const theme = PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.flipkart;

          return (
            <button
              key={p.platform}
              type="button"
              onClick={() => onSelectPlatform(p.platform)}
              className={`relative p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 overflow-hidden group select-none ${
                isSelected
                  ? `ring-2 ring-primary border-primary ${theme.bg} shadow-xs`
                  : `border-divider hover:border-default-400 bg-content2/40 hover:bg-content2/80`
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${theme.text}`}>
                  {PLATFORM_LABELS[p.platform]}
                </span>
                <span className="text-[10px] font-mono font-semibold text-default-500">
                  {share}%
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-bold text-foreground">
                  {count} <span className="text-[10px] font-normal text-default-400">kw</span>
                </span>
                <span className="text-[10px] text-default-400">
                  {p.top_scraped_titles?.length || 0} competitors
                </span>
              </div>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 transition-opacity"
                style={{
                  backgroundColor: theme.fill,
                  opacity: isSelected ? 1 : 0.4,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
