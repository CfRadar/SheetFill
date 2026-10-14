import React from "react";
import { Server, RefreshCw, Database, Sparkles, CheckCircle2 } from "lucide-react";

interface Props {
  elapsedSeconds: number;
  isFailed: boolean;
  onRetry: () => void;
}

export const ServerWakeScreen: React.FC<Props> = ({ elapsedSeconds, isFailed, onRetry }) => {
  // Smoothly asymptotically approaches 92% over 55s
  const rawProgress = Math.min(92, Math.round(100 * (1 - Math.exp(-elapsedSeconds / 28))));
  const displayProgress = isFailed ? 100 : rawProgress;

  const getTip = () => {
    if (isFailed) return "Container wake timed out. Please check your network or try again.";
    if (elapsedSeconds < 10) return "Connecting to application backend...";
    if (elapsedSeconds < 25) return "Spinning up free container instance on Render (~50s cold start)...";
    if (elapsedSeconds < 40) return "Initialising secure MongoDB cluster and session caches...";
    if (elapsedSeconds < 55) return "Almost ready! Loading Flipkart T-shirt workbook builder engine...";
    return "Still waking up, Render free tier instances take up to 60-70 seconds on initial cold start...";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6">
      <div className="relative max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-8 shadow-2xl shadow-indigo-950/50 text-center">
        {/* Glow backdrop */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Animated icon */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            {isFailed ? (
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            ) : (
              <Server className="w-8 h-8 animate-pulse text-blue-400" />
            )}
          </div>
          {!isFailed && (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
            </span>
          )}
        </div>

        <h2 className="text-xl font-bold tracking-tight text-slate-100">
          {isFailed ? "Server Wake Timeout" : "Waking Application Server"}
        </h2>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed min-h-[36px]">
          {getTip()}
        </p>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Render Free Instance
            </span>
            <span className="font-mono text-indigo-400">{isFailed ? "Error" : `${displayProgress}%`}</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFailed
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"
              }`}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <div className="mt-2 text-right">
            <span className="text-[10px] text-slate-500 font-mono">
              Elapsed: {elapsedSeconds}s
            </span>
          </div>
        </div>

        {isFailed ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        ) : (
          <div className="mt-6 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 flex items-start gap-2.5 text-left text-[11px] text-slate-400">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Free tier services go to sleep after 15 minutes of inactivity. Once awake, the app responds instantaneously.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
