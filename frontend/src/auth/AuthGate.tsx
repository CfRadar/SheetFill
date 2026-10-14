import React, { useEffect } from "react";
import { useAuthStore } from "./authStore";
import { LoginPage } from "./LoginPage";
import { AdminDashboard } from "../admin/AdminDashboard";
import { useServerWake } from "../wake/useServerWake";
import { ServerWakeScreen } from "../wake/ServerWakeScreen";
import { Clock, LogOut, ShieldCheck, User } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export const AuthGate: React.FC<Props> = ({ children }) => {
  const { status: wakeStatus, elapsedSeconds, retry: retryWake } = useServerWake();
  const { token, user, isAdminMode, setAdminMode, logout, checkSession } = useAuthStore();

  // Periodic session watcher: poll every 60s and on window focus
  useEffect(() => {
    if (!token) return;

    // Check once immediately on load
    checkSession();

    const interval = setInterval(() => {
      checkSession();
    }, 60000);

    const onFocus = () => {
      checkSession();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  // 1. Render server wake overlay if backend is cold
  if (wakeStatus === "checking" || wakeStatus === "waking" || wakeStatus === "failed") {
    return (
      <ServerWakeScreen
        elapsedSeconds={elapsedSeconds}
        isFailed={wakeStatus === "failed"}
        onRetry={retryWake}
      />
    );
  }

  // 2. Unauthenticated: render Login Page
  if (!token || !user) {
    return <LoginPage />;
  }

  // 3. Admin user navigating to /admin or with admin mode active
  if (user.role === "admin" && isAdminMode) {
    return <AdminDashboard />;
  }

  // 4. Subscriber authenticated: render application with subscription header bar
  const daysLeft = user.days_left;
  let badgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (daysLeft !== null && daysLeft !== undefined) {
    if (daysLeft <= 2) {
      badgeColor = "bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse";
    } else if (daysLeft <= 7) {
      badgeColor = "bg-amber-500/15 text-amber-400 border-amber-500/30";
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Subscriber Access Status Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 text-xs flex items-center justify-between shadow-sm">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>{user.display_name}</span>
              <span className="text-[11px] text-slate-500 font-mono">(@{user.username})</span>
            </div>

            {user.role === "admin" ? (
              <button
                type="button"
                onClick={() => setAdminMode(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>Admin Panel</span>
              </button>
            ) : daysLeft !== null && daysLeft !== undefined ? (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}
                title={`Expires on ${user.access_expires_at || "N/A"}`}
              >
                <Clock className="w-3 h-3" />
                <span>
                  {daysLeft === 0
                    ? "Expires today"
                    : `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={logout}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <LogOut className="w-3 h-3 text-slate-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
};
