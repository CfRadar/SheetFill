import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Chip,
  Card,
  CardBody,
} from "@heroui/react";
import {
  Key,
  ShieldCheck,
  Sparkles,
  Layers,
  Zap,
  ShoppingBag,
  Cpu,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { BriefForm } from "./BriefForm";
import { ProgressSteps } from "./ProgressSteps";
import { ResultsPanel } from "./ResultsPanel";
import { KeySettingsModal } from "./KeySettingsModal";
import { SystemCheckModal } from "./SystemCheckModal";
import { getKeyStatus, createRun, cancelRun, getRun, connectSSE } from "../api";
import type { ProductBrief, RunResult, KeyStatus, SSEEvent } from "../types";

const DEFAULT_BRIEF: ProductBrief = {
  platforms: ["amazon", "flipkart", "myntra", "meesho"],
  tshirt_type: "Oversized T-Shirt",
  color: "Black",
  gender: "men",
  fit: "Oversized",
  fabric: "100% Cotton",
  neck: "Round Neck",
  sleeve: "Half Sleeve",
  pattern: "Graphic Print",
  brand_name: "UrbanStyle",
  pack: "Single",
  price_min: 599,
  price_max: 999,
  extra_details: "Streetwear aesthetic with anime back print, heavyweight 240 GSM drop shoulder",
  research_sources: ["amazon", "flipkart", "myntra", "meesho", "google", "reddit"],
};

export const KeywordAgentPage: React.FC = () => {
  const [brief, setBrief] = useState<ProductBrief>(DEFAULT_BRIEF);
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isPreflightModalOpen, setIsPreflightModalOpen] = useState(false);

  // Run lifecycle state
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<SSEEvent["stage"]>(null);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanupSSE = useRef<(() => void) | null>(null);

  // Load key status on mount
  useEffect(() => {
    loadKeyStatus();
    return () => {
      if (cleanupSSE.current) {
        cleanupSSE.current();
      }
    };
  }, []);

  const loadKeyStatus = async () => {
    try {
      const status = await getKeyStatus();
      setKeyStatus(status);
    } catch (e) {
      console.warn("Could not load key status:", e);
    }
  };

  const handleStartRun = async () => {
    if (!keyStatus?.configured) {
      setIsKeyModalOpen(true);
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    setResult(null);
    setEvents([]);
    setCurrentStage("planner");

    try {
      const runResp = await createRun(brief);
      const runId = runResp.run_id;
      setCurrentRunId(runId);

      // Start listening to SSE stream
      const unsub = connectSSE(
        runId,
        (ev: SSEEvent) => {
          setEvents((prev) => [...prev, ev]);
          if (ev.stage) {
            setCurrentStage(ev.stage);
          }
          if (ev.type === "result" && ev.data) {
            setResult(ev.data);
            setIsRunning(false);
          }
          if (ev.type === "done") {
            setIsRunning(false);
            // Fetch final result if not already populated
            getRun(runId)
              .then((r) => {
                if (r.result) setResult(r.result);
              })
              .catch(console.warn);
          }
          if (ev.type === "error") {
            setIsRunning(false);
            setErrorMsg(ev.message || "Run encountered an unexpected error.");
          }
        },
        (err: any) => {
          console.error("SSE connection error:", err);
          // If SSE dropped, attempt to poll the run status
          getRun(runId)
            .then((r) => {
              if (r.result) {
                setResult(r.result);
                setIsRunning(false);
              }
            })
            .catch(() => {
              setIsRunning(false);
              setErrorMsg("Lost connection to real-time event stream.");
            });
        }
      );

      cleanupSSE.current = unsub;
    } catch (err: any) {
      setIsRunning(false);
      if (err?.code === "OPENROUTER_KEY_MISSING") {
        setErrorMsg("Please configure your OpenRouter API key first.");
        setIsKeyModalOpen(true);
      } else {
        setErrorMsg(err?.message || "Failed to start keyword agent run.");
      }
    }
  };

  const handleCancelRun = async () => {
    if (!currentRunId) return;
    try {
      await cancelRun(currentRunId);
    } catch (e) {
      console.warn("Could not cancel run:", e);
    } finally {
      if (cleanupSSE.current) {
        cleanupSSE.current();
      }
      setIsRunning(false);
      setErrorMsg("Run cancelled by user.");
    }
  };

  const handleReset = () => {
    if (cleanupSSE.current) {
      cleanupSSE.current();
    }
    setIsRunning(false);
    setCurrentRunId(null);
    setResult(null);
    setEvents([]);
    setErrorMsg(null);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full gap-5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-divider/70">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Marketplace Keyword Agent
            </h1>
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              className="text-[10px] font-semibold h-5 uppercase tracking-wider"
            >
              Multi-Agent AI
            </Chip>
          </div>
          <p className="text-xs text-default-500">
            Automated keyword discovery, competitor scraping & deterministic title generation across Amazon, Flipkart, Myntra, and Meesho.
          </p>
        </div>

        {/* Action Controls: BYOK Status, Key Modal, Preflight */}
        <div className="flex items-center gap-2">
          {keyStatus?.configured ? (
            <Chip
              size="sm"
              variant="flat"
              color="success"
              className="h-7 text-xs font-mono font-medium gap-1 cursor-pointer"
              onClick={() => setIsKeyModalOpen(true)}
            >
              <span className="text-[10px] opacity-75">KEY:</span> ••••{keyStatus.last4}
            </Chip>
          ) : (
            <Chip
              size="sm"
              variant="flat"
              color="warning"
              className="h-7 text-xs font-semibold gap-1 cursor-pointer"
              onClick={() => setIsKeyModalOpen(true)}
            >
              No Key Configured
            </Chip>
          )}

          <Button
            size="sm"
            variant="flat"
            className="h-8 text-xs font-medium gap-1.5"
            onPress={() => setIsKeyModalOpen(true)}
          >
            <Key className="w-3.5 h-3.5 text-primary" />
            <span>OpenRouter Key</span>
          </Button>

          <Button
            size="sm"
            variant="light"
            className="h-8 text-xs font-medium gap-1.5 text-default-500 hover:text-foreground"
            onPress={() => setIsPreflightModalOpen(true)}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
            <span>Preflight</span>
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Form: Sticky Product Brief */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <BriefForm
            brief={brief}
            onChange={setBrief}
            onSubmit={handleStartRun}
            isLoading={isRunning}
            isKeyConfigured={Boolean(keyStatus?.configured)}
            onOpenKeyModal={() => setIsKeyModalOpen(true)}
          />
        </div>

        {/* Right Output: Empty State, Live Progress Steps, or Results Panel */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Error Banner */}
          {errorMsg && (
            <Card className="border border-danger-200 bg-danger-50 dark:bg-danger-950/20 text-danger shadow-xs">
              <CardBody className="p-3.5 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 flex flex-col gap-1">
                  <span className="font-semibold">Generation Notice</span>
                  <span>{errorMsg}</span>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  className="h-6 text-[11px] px-2"
                  onPress={handleReset}
                >
                  Dismiss
                </Button>
              </CardBody>
            </Card>
          )}

          {/* 1. Live Running Progress */}
          {isRunning && (
            <ProgressSteps
              currentStage={currentStage}
              events={events}
              onCancel={handleCancelRun}
            />
          )}

          {/* 2. Completed Results */}
          {!isRunning && result && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-default-400">
                  Run ID: <code className="font-mono text-default-600">{result.run_id}</code>
                </span>
                <Button
                  size="sm"
                  variant="light"
                  className="h-7 text-xs text-default-500 gap-1"
                  onPress={handleReset}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Start New Run</span>
                </Button>
              </div>
              <ResultsPanel result={result} briefSummary={brief.tshirt_type} />
            </div>
          )}

          {/* 3. Idle / Welcome State */}
          {!isRunning && !result && (
            <Card className="border border-divider/70 bg-content1 shadow-xs">
              <CardBody className="p-6 sm:p-8 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">
                    Welcome to Marketplace Keyword Agent
                  </h3>
                  <p className="text-xs text-default-500 leading-relaxed max-w-xl">
                    Fill out the product brief on the left and select your target platforms. The multi-agent pipeline will scrape competitor benchmarks, score keywords using mathematical rankings, and construct strictly compliant titles.
                  </p>
                </div>

                {/* 3 Feature Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border border-divider/60 bg-default-50/50 dark:bg-default-900/20 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                      <span>Live Marketplace Intel</span>
                    </div>
                    <p className="text-[11px] text-default-500 leading-normal">
                      Pulls live autocomplete suggestions and competitor title patterns across Amazon, Flipkart, Myntra, and Meesho.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-divider/60 bg-default-50/50 dark:bg-default-900/20 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Cpu className="w-3.5 h-3.5 text-secondary" />
                      <span>Deterministic Formulas</span>
                    </div>
                    <p className="text-[11px] text-default-500 leading-normal">
                      Platform rules from rules.yaml compose titles safely. Character limits and banned claim whitelists are enforced automatically.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-divider/60 bg-default-50/50 dark:bg-default-900/20 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Zap className="w-3.5 h-3.5 text-success" />
                      <span>Zero Master Key (BYOK)</span>
                    </div>
                    <p className="text-[11px] text-default-500 leading-normal">
                      Every user uses their own OpenRouter key. Keys are encrypted at rest with Fernet AES and never exposed in responses or logs.
                    </p>
                  </div>
                </div>

                {/* Quick Start Prompt */}
                <div className="p-3.5 rounded-lg bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200/50 dark:border-primary-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-primary">
                      Ready to generate your first listing package?
                    </span>
                    <span className="text-[11px] text-default-500">
                      Click the "Generate Strategy & Titles" button or pick a preset brief above.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    color="primary"
                    className="font-semibold text-xs h-8 shrink-0"
                    onPress={handleStartRun}
                  >
                    Run Sample Brief
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      <KeySettingsModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeyUpdated={(status) => {
          setKeyStatus(status);
        }}
      />

      <SystemCheckModal
        isOpen={isPreflightModalOpen}
        onClose={() => setIsPreflightModalOpen(false)}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
      />
    </div>
  );
};
