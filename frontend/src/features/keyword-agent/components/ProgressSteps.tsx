import React from "react";
import { Card, CardBody, Progress, Button, Chip } from "@heroui/react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  XCircle,
  Search,
  Database,
  Calculator,
  PenTool,
} from "lucide-react";
import type { SSEEvent } from "../types";

interface Props {
  currentStage?: "planner" | "marketplace" | "social" | "analyst" | "system" | null;
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
    desc: "Structuring search intent, attributes, and candidate keywords",
    icon: Search,
  },
  {
    key: "marketplace",
    title: "2. Scraper Intelligence",
    desc: "Querying Amazon, Flipkart, Myntra, Meesho suggestions and competitor titles",
    icon: Database,
  },
  {
    key: "scoring",
    title: "3. 5-Factor Scoring",
    desc: "Mathematical ranking: Suggest (35%) + Title (25%) + Reviews (20%) + Social + Brief",
    icon: Calculator,
  },
  {
    key: "analyst",
    title: "4. Title Engine Composition",
    desc: "Applying deterministic platform formulas, word whitelists, and length rules",
    icon: PenTool,
  },
];

export const ProgressSteps: React.FC<Props> = ({ currentStage, events, onCancel }) => {
  // Determine active step index
  let activeIndex = 0;
  if (currentStage === "marketplace" || currentStage === "social") activeIndex = 1;
  else if (currentStage === "analyst") activeIndex = 3;

  // Check if events have indicated scoring
  const hasScoringEvent = events.some(
    (e) => (e.stage as any) === "scoring" || e.node_id === "scoring" || e.message?.toLowerCase().includes("scoring")
  );
  if (hasScoringEvent && activeIndex < 2) {
    activeIndex = 2;
  }

  // Get last 3 event log messages
  const recentLogs = events
    .filter((e) => Boolean(e.message || e.detail))
    .slice(-4)
    .reverse();

  return (
    <Card className="border border-divider/70 bg-content1 shadow-xs">
      <CardBody className="p-5 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-divider/60">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <h3 className="text-sm font-semibold text-foreground">
              Marketplace Keyword Agent Running...
            </h3>
          </div>
          {onCancel && (
            <Button
              size="sm"
              variant="flat"
              color="danger"
              className="h-7 text-xs px-2.5 font-medium gap-1"
              onPress={onCancel}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Run</span>
            </Button>
          )}
        </div>

        {/* Stepper Graphic */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isPending = idx > activeIndex;

            return (
              <div
                key={step.key}
                className={`p-3 rounded-lg border transition-all flex flex-col gap-2 ${
                  isCurrent
                    ? "border-primary bg-primary-50/40 dark:bg-primary-950/20 shadow-xs"
                    : isDone
                    ? "border-success-300 bg-success-50/30 dark:bg-success-950/20 text-success-700 dark:text-success-300"
                    : "border-divider/60 bg-content2/20 text-default-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="font-semibold">{step.title}</span>
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
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

        {/* Live Logs Stream */}
        {recentLogs.length > 0 && (
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-default-50/70 dark:bg-default-900/30 border border-divider/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-default-400">
              Live Activity Stream:
            </span>
            <div className="flex flex-col gap-1">
              {recentLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs font-mono text-default-600 dark:text-default-300"
                >
                  <span className="text-[10px] text-default-400">
                    {new Date(log.ts).toLocaleTimeString()}
                  </span>
                  <span className="text-primary">•</span>
                  <span className="truncate">{log.message || log.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
