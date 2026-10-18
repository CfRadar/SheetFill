import React, { useState, useEffect } from "react";
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
import { getKeyStatus, createRun, getRun } from "../api";
import { sseManager } from "../service/sseManager";
import { useAppStore } from "../../../store";
import type { ProductBrief, RunResult, KeyStatus, SSEEvent } from "../types";

export const KeywordAgentPage: React.FC = () => {
  const {
    brief,
    updateBrief,
    currentRunId,
    runStatus,
    currentStage,
    events,
    result,
    errorMsg,
    setKeywordAgentState,
    appendKeywordEvent,
    resetKeywordAgent,
  } = useAppStore();

  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isPreflightModalOpen, setIsPreflightModalOpen] = useState(false);

  // Load key status on mount
  useEffect(() => {
    loadKeyStatus();
  }, []);

  // Resume listener if run was in-progress when page loaded
  useEffect(() => {
    if (runStatus === "running" && currentRunId && !sseManager.isStreaming(currentRunId)) {
      attachStream(currentRunId);
    }
  }, [runStatus, currentRunId]);

  const loadKeyStatus = async () => {
    try {
      const status = await getKeyStatus();
      setKeyStatus(status);
    } catch (e) {
      console.warn("Could not load key status:", e);
    }
  };

  const attachStream = (runId: string) => {
    sseManager.startStream(
      runId,
      (ev: SSEEvent) => {
        appendKeywordEvent(ev);
        if (ev.type === "result" && ev.data) {
          setKeywordAgentState({ result: ev.data, runStatus: "success" });
        } else if (ev.type === "done") {
          setKeywordAgentState({ runStatus: "success" });
          getRun(runId)
            .then((r) => {
              if (r.result) setKeywordAgentState({ result: r.result });
            })
            .catch(console.warn);
        } else if (ev.type === "error") {
          setKeywordAgentState({
            runStatus: "error",
            errorMsg: ev.message || "Run encountered an unexpected error.",
          });
        }
      },
      (err: any) => {
        console.error("SSE connection error:", err);
        getRun(runId)
          .then((r) => {
            if (r.result) {
              setKeywordAgentState({ result: r.result, runStatus: "success" });
            } else {
              setKeywordAgentState({
                runStatus: "error",
                errorMsg: "Lost connection to real-time event stream.",
              });
            }
          })
          .catch(() => {
            setKeywordAgentState({
              runStatus: "error",
              errorMsg: "Lost connection to real-time event stream.",
            });
          });
      },
      () => {
        // onDone
      }
    );
  };

  const handleStartRun = async () => {
    if (!keyStatus?.configured) {
      setIsKeyModalOpen(true);
      return;
    }

    setKeywordAgentState({
      runStatus: "running",
      errorMsg: null,
      result: null,
      events: [],
      currentStage: "planner",
    });

    try {
      const runResp = await createRun(brief);
      const runId = runResp.run_id;
      setKeywordAgentState({ currentRunId: runId });

      // Start stream via persistent sseManager
      attachStream(runId);
    } catch (err: any) {
      setKeywordAgentState({ runStatus: "idle" });
      if (err?.code === "OPENROUTER_KEY_MISSING") {
        setKeywordAgentState({ errorMsg: "Please configure your OpenRouter API key first." });
        setIsKeyModalOpen(true);
      } else {
        setKeywordAgentState({ errorMsg: err?.message || "Failed to start keyword agent run." });
      }
    }
  };

  const handleCancelRun = async () => {
    if (!currentRunId) return;
    try {
      await sseManager.cancelAndStop(currentRunId);
    } catch (e) {
      console.warn("Could not cancel run:", e);
    } finally {
      setKeywordAgentState({
        runStatus: "cancelled",
        errorMsg: "Run cancelled by user.",
      });
    }
  };

  const handleReset = () => {
    if (currentRunId) {
      sseManager.stopStream();
    }
    resetKeywordAgent();
  };

  const isRunning = runStatus === "running";

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full gap-5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-divider">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Marketplace Keyword Agent
          </h1>
          <p className="text-xs text-default-500 mt-0.5">
            AI-driven competitive keyword research & high-conversion title composer across Amazon, Flipkart, Myntra, and Meesho
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="flat"
            color="default"
            onPress={() => setIsPreflightModalOpen(true)}
            className="text-xs h-8"
            startContent={<ShieldCheck className="w-3.5 h-3.5 text-default-500" />}
          >
            Diagnostics
          </Button>

          <Button
            size="sm"
            variant="flat"
            color={keyStatus?.configured ? "success" : "warning"}
            onPress={() => setIsKeyModalOpen(true)}
            className="text-xs font-medium h-8"
            startContent={<Key className="w-3.5 h-3.5" />}
          >
            {keyStatus?.configured ? `OpenRouter Key (...${keyStatus.last4})` : "Configure BYOK Key"}
          </Button>

          {(result || events.length > 0) && (
            <Button
              size="sm"
              variant="light"
              color="default"
              onPress={handleReset}
              className="text-xs h-8 text-default-600"
              startContent={<RotateCcw className="w-3.5 h-3.5" />}
            >
              New Research
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col gap-6">
        {/* Step 1: Input Brief Form (Always visible or in edit mode) */}
        {!result && (
          <BriefForm
            brief={brief}
            onChange={(next) => updateBrief(next)}
            onSubmit={handleStartRun}
            isLoading={isRunning}
            isKeyConfigured={Boolean(keyStatus?.configured)}
            onOpenKeyModal={() => setIsKeyModalOpen(true)}
          />
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-danger-50 dark:bg-danger-950/40 text-danger border border-danger-200 dark:border-danger-800 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {!keyStatus?.configured && (
              <Button
                size="sm"
                color="danger"
                variant="flat"
                className="h-7 text-xs"
                onPress={() => setIsKeyModalOpen(true)}
              >
                Set Key
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Live Progress & Execution Stepper */}
        {isRunning && (
          <ProgressSteps
            stage={currentStage}
            events={events}
            onCancel={handleCancelRun}
          />
        )}

        {/* Step 3: Comprehensive Multi-Platform Results */}
        {result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Chip size="sm" color="success" variant="flat" className="font-semibold text-xs">
                  Research Completed
                </Chip>
                <span className="text-xs text-default-500 font-mono">Run: {currentRunId}</span>
              </div>

              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={handleReset}
                startContent={<RotateCcw className="w-3.5 h-3.5" />}
                className="text-xs h-8"
              >
                Start Fresh Run
              </Button>
            </div>

            <ResultsPanel result={result} briefSummary={`${brief.gender} ${brief.tshirt_type} (${brief.color})`} />
          </div>
        )}
      </div>

      {/* BYOK Settings Modal */}
      <KeySettingsModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeyUpdated={(stat) => setKeyStatus(stat)}
      />

      {/* System Preflight Diagnostics Modal */}
      <SystemCheckModal
        isOpen={isPreflightModalOpen}
        onClose={() => setIsPreflightModalOpen(false)}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
      />
    </div>
  );
};
