import React, { useState } from "react";
import { Progress, Button, Skeleton } from "@heroui/react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Search,
  Database,
  Calculator,
  PenTool,
  ChevronDown,
  ChevronUp,
  Terminal,
} from "lucide-react";
import type { SSEEvent } from "../types";

interface Props {
  stage?: "planner" | "marketplace" | "social" | "analyst" | "system" | null;
  events: SSEEvent[];
  onCancel?: () => void;
}

interface StepDef {
  key: "planner" | "marketplace" | "scoring" | "analyst";
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepDef[] = [
  {
    key: "planner",
    title: "1. Intent & Planning",
    desc: "Structuring search queries across 4 marketplaces",
    icon: Search,
  },
  {
    key: "marketplace",
    title: "2. Scraper Intelligence",
    desc: "Live catalog search on Amazon, Flipkart, Myntra, Meesho",
    icon: Database,
  },
  {
    key: "scoring",
    title: "3. 5-Factor Ranking",
    desc: "Bayesian rating-weighted scoring & demand metrics",
    icon: Calculator,
  },
  {
    key: "analyst",
    title: "4. Title Composition",
    desc: "Deterministic rule composition & length compliance",
    icon: PenTool,
  },
];

export const ProgressSteps: React.FC<Props> = ({ stage, events, onCancel }) => {
  const [isLogExpanded, setIsLogExpanded] = useState(false);

  // Determine active step index
  let activeIndex = 0;
  if (stage === "marketplace" || stage === "social") activeIndex = 1;
  else if (stage === "analyst") activeIndex = 3;

  const hasScoringEvent = events.some(
    (e) => (e.stage as any) === "scoring" || e.node_id === "scoring" || e.message?.toLowerCase().includes("scoring")
  );
  if (hasScoringEvent && activeIndex < 2) {
    activeIndex = 2;
  }

  const percentProgress = Math.min(100, Math.round(((activeIndex + 0.6) / STEPS.length) * 100));

  const recentLogs = events
    .filter((e) => Boolean(e.message || e.detail))
    .slice(-8)
    .reverse();

  return (
    <div className="w-full rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-md p-5 sm:p-6 flex flex-col gap-6 shadow-xs">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-divider/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Marketplace Keyword Pipeline Running
            </h3>
            <p className="text-[11px] text-default-400">
              Aggregating competitor insights & calculating Bayesian rating rankings
            </p>
          </div>
        </div>

        {onCancel && (
          <Button
            size="sm"
            variant="flat"
            color="danger"
            className="h-8 text-xs px-3 font-semibold rounded-xl"
            onPress={onCancel}
            startContent={<XCircle className="w-3.5 h-3.5" />}
          >
            Cancel Run
          </Button>
        )}
      </div>

      {/* Slim Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-primary">Pipeline Progress</span>
          <span className="font-mono text-default-400">{percentProgress}%</span>
        </div>
        <Progress
          size="sm"
          value={percentProgress}
          color="primary"
          className="w-full"
          aria-label="Research progress"
        />
      </div>

      {/* 4-Stage Horizontal Stepper with Connecting Line */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < activeIndex;
          const isCurrent = idx === activeIndex;

          return (
            <div
              key={step.key}
              className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-2 ${
                isCurrent
                  ? "border-primary bg-primary-50/50 dark:bg-primary-950/30 shadow-xs ring-1 ring-primary/30"
                  : isDone
                  ? "border-success-200 dark:border-success-900/40 bg-success-50/40 dark:bg-success-950/20 text-success-800 dark:text-success-200"
                  : "border-divider/60 bg-content2/30 text-default-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{step.title}</span>
                </div>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-default-300" />
                )}
              </div>
              <p className="text-[11px] leading-tight text-default-500">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Skeleton Preview of Final Results Dashboard (Prevents empty blank area) */}
      <div className="p-4 rounded-xl border border-divider/60 bg-content2/20 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-default-500">
          <span>Preparing Results Dashboard</span>
          <span className="text-[10px] text-default-400 font-normal">Streaming output...</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-xl bg-default-100 dark:bg-default-800/40" />
          <Skeleton className="h-24 rounded-xl bg-default-100 dark:bg-default-800/40" />
          <Skeleton className="h-24 rounded-xl bg-default-100 dark:bg-default-800/40" />
        </div>
        <Skeleton className="h-14 rounded-xl bg-default-100 dark:bg-default-800/40" />
      </div>

      {/* Collapsible Activity Stream Log */}
      <div className="rounded-xl border border-divider/60 bg-default-50/60 dark:bg-default-900/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsLogExpanded(!isLogExpanded)}
          className="w-full p-3 flex items-center justify-between text-xs font-semibold text-default-600 hover:text-foreground transition-colors select-none focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span>Live Activity Stream ({events.length} events logged)</span>
          </div>
          {isLogExpanded ? (
            <ChevronUp className="w-4 h-4 text-default-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-default-400" />
          )}
        </button>

        {isLogExpanded && recentLogs.length > 0 && (
          <div className="p-3 border-t border-divider/60 bg-content1/40 flex flex-col gap-1.5 font-mono text-xs max-h-48 overflow-y-auto">
            {recentLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2 text-default-600 dark:text-default-300">
                <span className="text-[10px] text-default-400 shrink-0">
                  {new Date(log.ts).toLocaleTimeString()}
                </span>
                <span className="text-primary shrink-0">▸</span>
                <span className="truncate">{log.message || log.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
