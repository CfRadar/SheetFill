import React from "react";
import type { PlatformName } from "../types";

interface Props {
  selectedPlatforms: PlatformName[];
  onChange: (platforms: PlatformName[]) => void;
}

const PLATFORMS: {
  id: PlatformName;
  label: string;
  theme: { activeBg: string; activeText: string; activeBorder: string; dot: string };
}[] = [
  {
    id: "amazon",
    label: "Amazon",
    theme: {
      activeBg: "bg-amber-500/15 dark:bg-amber-500/25",
      activeText: "text-amber-700 dark:text-amber-300 font-bold",
      activeBorder: "border-amber-500/60 ring-1 ring-amber-500/40",
      dot: "bg-amber-500",
    },
  },
  {
    id: "flipkart",
    label: "Flipkart",
    theme: {
      activeBg: "bg-blue-500/15 dark:bg-blue-500/25",
      activeText: "text-blue-700 dark:text-blue-300 font-bold",
      activeBorder: "border-blue-500/60 ring-1 ring-blue-500/40",
      dot: "bg-blue-500",
    },
  },
  {
    id: "myntra",
    label: "Myntra",
    theme: {
      activeBg: "bg-rose-500/15 dark:bg-rose-500/25",
      activeText: "text-rose-700 dark:text-rose-300 font-bold",
      activeBorder: "border-rose-500/60 ring-1 ring-rose-500/40",
      dot: "bg-rose-500",
    },
  },
  {
    id: "meesho",
    label: "Meesho",
    theme: {
      activeBg: "bg-pink-500/15 dark:bg-pink-500/25",
      activeText: "text-pink-700 dark:text-pink-300 font-bold",
      activeBorder: "border-pink-500/60 ring-1 ring-pink-500/40",
      dot: "bg-pink-500",
    },
  },
];

export const PlatformPicker: React.FC<Props> = ({ selectedPlatforms, onChange }) => {
  const togglePlatform = (p: PlatformName) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length === 1) return; // Keep at least one platform selected
      onChange(selectedPlatforms.filter((item) => item !== p));
    } else {
      onChange([...selectedPlatforms, p]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-foreground flex items-center justify-between">
        <span>Target Marketplaces</span>
        <span className="text-[11px] text-default-400 font-normal">Select 1 to 4 platforms</span>
      </label>
      <div className="flex flex-wrap gap-2.5">
        {PLATFORMS.map((plat) => {
          const isSelected = selectedPlatforms.includes(plat.id);
          const { activeBg, activeText, activeBorder, dot } = plat.theme;

          return (
            <button
              key={plat.id}
              type="button"
              onClick={() => togglePlatform(plat.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs transition-all duration-150 select-none ${
                isSelected
                  ? `${activeBg} ${activeText} ${activeBorder} shadow-2xs`
                  : "bg-content2/40 hover:bg-content2 text-default-600 border-divider hover:border-default-400"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isSelected ? dot : "bg-default-300"}`} />
              <span>{plat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
