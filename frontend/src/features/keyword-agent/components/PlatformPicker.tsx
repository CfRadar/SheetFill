import React from "react";
import { Chip } from "@heroui/react";
import type { PlatformName } from "../types";

interface Props {
  selectedPlatforms: PlatformName[];
  onChange: (platforms: PlatformName[]) => void;
}

const PLATFORMS: { id: PlatformName; label: string; color: "warning" | "primary" | "secondary" | "danger" }[] = [
  { id: "amazon", label: "Amazon", color: "warning" },
  { id: "flipkart", label: "Flipkart", color: "primary" },
  { id: "myntra", label: "Myntra", color: "danger" },
  { id: "meesho", label: "Meesho", color: "secondary" },
];

export const PlatformPicker: React.FC<Props> = ({ selectedPlatforms, onChange }) => {
  const togglePlatform = (p: PlatformName) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length === 1) return; // Keep at least one
      onChange(selectedPlatforms.filter((item) => item !== p));
    } else {
      onChange([...selectedPlatforms, p]);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground flex items-center justify-between">
        <span>Target Marketplaces</span>
        <span className="text-[11px] text-default-400 font-normal">Select 1 to 4</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((plat) => {
          const isSelected = selectedPlatforms.includes(plat.id);
          return (
            <Chip
              key={plat.id}
              as="button"
              type="button"
              variant={isSelected ? "solid" : "bordered"}
              color={isSelected ? plat.color : "default"}
              onClick={() => togglePlatform(plat.id)}
              className="cursor-pointer transition-transform hover:scale-[1.02] text-xs font-medium"
            >
              {plat.label}
            </Chip>
          );
        })}
      </div>
    </div>
  );
};
