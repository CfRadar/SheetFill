import React, { useState } from "react";
import { Card, CardBody, Chip, Button, Tooltip } from "@heroui/react";
import { Copy, Check, AlertTriangle, Layers, Info } from "lucide-react";
import type { TitleSuggestion, PlatformName, PartLabel } from "../types";

interface Props {
  suggestion: TitleSuggestion;
  platform: PlatformName;
}

const PLATFORM_LIMITS: Record<PlatformName, { max: number; idealMin: number; idealMax: number }> = {
  amazon: { max: 200, idealMin: 120, idealMax: 180 },
  flipkart: { max: 80, idealMin: 45, idealMax: 75 },
  myntra: { max: 70, idealMin: 40, idealMax: 65 },
  meesho: { max: 60, idealMin: 35, idealMax: 55 },
};

const STYLE_LABELS: Record<string, { label: string; color: "primary" | "secondary" | "success" | "default" }> = {
  search: { label: "Search Focused", color: "primary" },
  balanced: { label: "Balanced", color: "secondary" },
  short: { label: "Short & Punchy", color: "success" },
};

const PART_COLOR_MAP: Record<PartLabel, string> = {
  brand: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200",
  gender: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200",
  fit: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200",
  fabric: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200",
  color: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200",
  type: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200",
  tshirt_type: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200",
  neck: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200",
  sleeve: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200",
  pattern: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200",
  occasion: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200",
  pack: "bg-stone-100 text-stone-800 dark:bg-stone-900/40 dark:text-stone-300 border-stone-200",
  feature: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 border-pink-200",
};

export const TitleCard: React.FC<Props> = ({ suggestion, platform }) => {
  const [copied, setCopied] = useState(false);
  const [showParts, setShowParts] = useState(false);

  const limits = PLATFORM_LIMITS[platform] || { max: 100, idealMin: 40, idealMax: 80 };
  const length = suggestion.length || suggestion.title.length;
  const isOver = length > limits.max;
  const isOptimal = length >= limits.idealMin && length <= limits.idealMax;

  const styleMeta = STYLE_LABELS[suggestion.style] || {
    label: suggestion.style,
    color: "default" as const,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Could not copy title:", e);
    }
  };

  return (
    <Card className="border border-divider/70 bg-content1 shadow-2xs hover:border-default-400 transition-colors">
      <CardBody className="p-3.5 sm:p-4 flex flex-col gap-2.5">
        {/* Header: Style chip, Length counter, Copy button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Chip
              size="sm"
              variant="flat"
              color={styleMeta.color}
              className="text-[11px] font-semibold h-5 uppercase tracking-wider"
            >
              {styleMeta.label}
            </Chip>
            <div className="flex items-center gap-1 text-[11px]">
              <span
                className={`font-mono font-medium ${
                  isOver
                    ? "text-danger"
                    : isOptimal
                    ? "text-success"
                    : "text-default-500"
                }`}
              >
                {length}/{limits.max}
              </span>
              <span className="text-default-400">chars</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {suggestion.parts && suggestion.parts.length > 0 && (
              <Button
                size="sm"
                variant="light"
                className="h-7 text-[11px] px-2 text-default-500 gap-1"
                onPress={() => setShowParts(!showParts)}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{showParts ? "Hide Breakdown" : "Breakdown"}</span>
              </Button>
            )}
            <Button
              size="sm"
              variant={copied ? "solid" : "flat"}
              color={copied ? "success" : "default"}
              className="h-7 text-xs px-2.5 font-medium gap-1"
              onPress={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Title Text */}
        <div className="p-2.5 rounded-md bg-default-50 dark:bg-default-100/30 border border-divider/50 font-medium text-sm text-foreground leading-relaxed select-text">
          {suggestion.title}
        </div>

        {/* Warnings if any */}
        {suggestion.warnings && suggestion.warnings.length > 0 && (
          <div className="flex items-start gap-1.5 text-[11px] text-warning-600 dark:text-warning-400 bg-warning-50/50 dark:bg-warning-950/20 p-2 rounded">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex flex-col">
              {suggestion.warnings.map((w, idx) => (
                <span key={idx}>{w}</span>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Breakdown of Deterministic Title Parts */}
        {showParts && suggestion.parts && suggestion.parts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-divider/60">
            <span className="text-[11px] text-default-400 font-medium mr-1">Parts:</span>
            {suggestion.parts.map((part, idx) => {
              const colorClass =
                PART_COLOR_MAP[part.label] ||
                "bg-default-100 text-default-700 border-default-200";
              return (
                <span
                  key={idx}
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${colorClass}`}
                >
                  <span className="opacity-60 text-[9px] uppercase mr-1">{part.label}:</span>
                  <span className="font-semibold">{part.text}</span>
                </span>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
