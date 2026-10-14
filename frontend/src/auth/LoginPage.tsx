import React, { useState } from "react";
import { useAuthStore } from "./authStore";
import {
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Laptop,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export const LoginPage: React.FC = () => {
  const { loginUser, loginAdmin, isLoading, errorNotice, setErrorNotice } = useAuthStore();
  const [isAdminTab, setIsAdminTab] = useState(
    window.location.pathname.startsWith("/admin") || window.location.hash === "#admin"
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setErrorNotice(null);

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setLocalError("Please enter both username and password.");
      return;
    }

    try {
      if (isAdminTab) {
        await loginAdmin(cleanUser, password);
      } else {
        await loginUser(cleanUser, password);
      }
    } catch (err: any) {
      // Handled in store notice or fallback
      setLocalError(err?.message || "Login failed");
    }
  };

  const currentNotice = errorNotice || (localError ? { code: "ERROR", message: localError } : null);

  const getNoticeTheme = (code: string) => {
    if (code === "SESSION_REPLACED") {
      return {
        bg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
        icon: <Laptop className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
        title: "Session Terminated Elsewhere",
      };
    }
    if (code === "ACCOUNT_EXPIRED") {
      return {
        bg: "bg-rose-500/10 border-rose-500/30 text-rose-300",
        icon: <Clock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
        title: "Subscription Expired",
      };
    }
    if (code === "ACCOUNT_DISABLED") {
      return {
        bg: "bg-red-500/10 border-red-500/30 text-red-300",
        icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
        title: "Account Suspended",
      };
    }
    return {
      bg: "bg-red-500/10 border-red-500/30 text-red-300",
      icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
      title: "Authentication Error",
    };
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 select-none">
      <div className="relative w-full max-w-md">
        {/* Decorative blur orbs */}
        <div className="absolute -top-16 -left-16 w-44 h-44 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Card */}
        <div className="relative bg-slate-900/90 backdrop-blur-2xl border border-slate-700/60 rounded-3xl p-8 shadow-2xl shadow-black/80">
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 mb-3 text-yellow-300 font-black text-xl">
              FK
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Flipkart Sheet Filler
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Zero-corruption listing automation system
            </p>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-800/80 rounded-xl mb-6 border border-slate-700/50">
            <button
              type="button"
              onClick={() => {
                setIsAdminTab(false);
                setErrorNotice(null);
                setLocalError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !isAdminTab
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Subscriber Login
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdminTab(true);
                setErrorNotice(null);
                setLocalError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isAdminTab
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Owner / Admin
            </button>
          </div>

          {/* Error Notice Banner */}
          {currentNotice && (
            <div
              className={`mb-5 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                getNoticeTheme(currentNotice.code).bg
              }`}
            >
              {getNoticeTheme(currentNotice.code).icon}
              <div className="flex-1">
                <div className="font-semibold">{getNoticeTheme(currentNotice.code).title}</div>
                <div className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                  {currentNotice.message}
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {isAdminTab ? "Admin Username" : "Username"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isAdminTab ? "admin" : "e.g. seller_username"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Verifying Session...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Sheet Filler</span>
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                </>
              )}
            </button>
          </form>

          {/* Device policy reassurance footnote */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Laptop className="w-3.5 h-3.5 text-blue-400" />
              <span>Single active device session strictly enforced</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Need access? Contact the system owner to obtain an account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
