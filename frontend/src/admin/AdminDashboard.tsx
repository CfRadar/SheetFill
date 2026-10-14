import React, { useEffect, useState } from "react";
import { useAuthStore } from "../auth/authStore";
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  disableAdminUser,
  enableAdminUser,
  forceLogoutAdminUser,
  deleteAdminUser,
  getAdminStats,
  getAdminActivity,
} from "../api";
import {
  Users,
  ShieldAlert,
  Activity,
  Plus,
  Search,
  RefreshCw,
  LogOut,
  Calendar,
  Lock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Sparkles,
  Laptop,
  ArrowRight,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

export const AdminDashboard: React.FC = () => {
  const { user, logout, setAdminMode } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "activity">("overview");

  // Stats
  const [stats, setStats] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  // Activity Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logEventFilter, setLogEventFilter] = useState("");
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDurationDays, setNewDurationDays] = useState(30);
  const [newNotes, setNewNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);
  const [createErrorMsg, setCreateErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Action status feedback
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsStatsLoading(true);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats", err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const data = await listAdminUsers({
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        page,
        limit: 20,
      });
      setUsers(data.items || []);
      setUsersTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const fetchLogs = async () => {
    setIsLogsLoading(true);
    try {
      const data = await getAdminActivity({
        event: logEventFilter || undefined,
        limit: 50,
      });
      setLogs(data.items || []);
    } catch (err) {
      console.error("Failed to load logs", err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "overview") fetchStats();
    if (activeTab === "users") fetchUsers();
    if (activeTab === "activity") fetchLogs();
  }, [activeTab, page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let p = "";
    for (let i = 0; i < 12; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(p);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;

    setIsCreating(true);
    setCreateSuccessMsg(null);
    setCreateErrorMsg(null);
    try {
      await createAdminUser({
        username: newUsername.trim().toLowerCase(),
        password: newPassword,
        display_name: newDisplayName.trim() || undefined,
        duration_days: newDurationDays,
        notes: newNotes.trim() || undefined,
      });

      setCreateSuccessMsg(`User '${newUsername}' successfully created with ${newDurationDays} days access!`);
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      setCreateErrorMsg(err.message || "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  };

  const handleExtend = async (uid: string, days: string) => {
    try {
      await updateAdminUser(uid, { extension: `+${days}d` });
      setActionFeedback(`Extended subscription by ${days} days.`);
      fetchUsers();
      fetchStats();
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || "Extension failed");
    }
  };

  const handleToggleActive = async (uid: string, currentActive: boolean) => {
    try {
      if (currentActive) {
        await disableAdminUser(uid);
        setActionFeedback("Account deactivated and active sessions revoked.");
      } else {
        await enableAdminUser(uid);
        setActionFeedback("Account re-enabled.");
      }
      fetchUsers();
      fetchStats();
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update user status");
    }
  };

  const handleForceLogout = async (uid: string) => {
    try {
      await forceLogoutAdminUser(uid);
      setActionFeedback("Force-logged out all devices for user.");
      fetchUsers();
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || "Force logout failed");
    }
  };

  const handleDelete = async (uid: string, uname: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user '${uname}'?`)) return;
    try {
      await deleteAdminUser(uid);
      setActionFeedback(`User '${uname}' deleted.`);
      fetchUsers();
      fetchStats();
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || "Delete failed");
    }
  };

  const copyCredentials = () => {
    const text = `Username: ${newUsername}\nPassword: ${newPassword}\nAccess Duration: ${newDurationDays} Days\nLink: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-sm text-yellow-300 shadow">
            FK
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">Admin & Access Control</h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                OWNER PANEL
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Subscriber access, single-device control & activity audit</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAdminMode(false)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>Open Sheet Filler App</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "overview"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview & Stats</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "users"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Subscribers Management</span>
            {usersTotal > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                {usersTotal}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "activity"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Audit Activity Logs</span>
          </button>
        </div>
      </div>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">System Metrics & Subscription Status</h2>
                <p className="text-xs text-slate-400">Live operational data cached with 15s automatic refresh</p>
              </div>
              <button
                type="button"
                onClick={fetchStats}
                disabled={isStatsLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isStatsLoading ? "animate-spin text-blue-400" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* 6 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow">
                <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Total Subscribers</div>
                  <div className="text-2xl font-black text-white mt-0.5">
                    {stats ? stats.total_users : "—"}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow">
                <div className="w-12 h-12 rounded-xl bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Active Subscriptions</div>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">
                    {stats ? stats.active_subscriptions : "—"}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow">
                <div className="w-12 h-12 rounded-xl bg-amber-600/15 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Expiring Soon (≤ 7 Days)</div>
                  <div className="text-2xl font-black text-amber-400 mt-0.5">
                    {stats ? stats.expiring_soon : "—"}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow">
                <div className="w-12 h-12 rounded-xl bg-rose-600/15 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Expired Accounts</div>
                  <div className="text-2xl font-black text-rose-400 mt-0.5">
                    {stats ? stats.expired : "—"}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Active Online Now (Last 5m)</div>
                  <div className="text-2xl font-black text-indigo-400 mt-0.5">
                    {stats ? stats.online_now : "—"}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow">
                <div className="w-12 h-12 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Successful Logins Today</div>
                  <div className="text-2xl font-black text-violet-400 mt-0.5">
                    {stats ? stats.logins_today : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white">Need to create or renew subscriber access?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate accounts with automated password generation and copy credentials instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  generatePassword();
                  setIsCreateOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Subscriber</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: SUBSCRIBERS MANAGEMENT */}
        {/* ================================================================= */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Subscriber Accounts</h2>
                <p className="text-xs text-slate-400">Manage client access, durations, password resets, and session revoking</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  generatePassword();
                  setNewUsername("");
                  setNewDisplayName("");
                  setNewNotes("");
                  setCreateSuccessMsg(null);
                  setIsCreateOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Create Subscriber</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <form onSubmit={handleSearchSubmit} className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search username, name, or notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </form>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="expired">Expired Only</option>
                  <option value="disabled">Disabled Only</option>
                </select>
                <button
                  type="button"
                  onClick={fetchUsers}
                  disabled={isUsersLoading}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isUsersLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                      <th className="py-3 px-4">Subscriber</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Access Expiry</th>
                      <th className="py-3 px-4">Last Login</th>
                      <th className="py-3 px-4">Notes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                          {isUsersLoading ? "Loading subscribers..." : "No subscriber accounts found."}
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const statusColors: any = {
                          active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                          expired: "bg-rose-500/15 text-rose-400 border-rose-500/30",
                          disabled: "bg-slate-700 text-slate-400 border-slate-600",
                        };

                        return (
                          <tr key={u.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-[11px]">
                                    {u.username.substring(0, 2).toUpperCase()}
                                  </div>
                                  {u.is_online && (
                                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-white">{u.display_name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">@{u.username}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  statusColors[u.status] || statusColors.active
                                }`}
                              >
                                {u.status.toUpperCase()}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              {u.access_expires_at ? (
                                <div>
                                  <div className="text-slate-200">
                                    {new Date(u.access_expires_at).toLocaleDateString()}
                                  </div>
                                  <div
                                    className={`text-[10px] font-medium ${
                                      u.days_left && u.days_left <= 7
                                        ? "text-amber-400 font-bold"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {u.days_left !== null ? `${u.days_left} days left` : "Expired"}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-500">Unlimited</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {u.last_login_at
                                ? new Date(u.last_login_at).toLocaleString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Never logged in"}
                            </td>

                            <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[200px] truncate">
                              {u.notes || "—"}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Extend shortcuts */}
                                <div className="inline-flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleExtend(u.id, "7")}
                                    className="px-1.5 py-0.5 text-[10px] hover:text-white text-slate-400 cursor-pointer"
                                    title="Add 7 days"
                                  >
                                    +7d
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleExtend(u.id, "30")}
                                    className="px-1.5 py-0.5 text-[10px] hover:text-white text-slate-400 cursor-pointer border-l border-slate-700"
                                    title="Add 30 days"
                                  >
                                    +30d
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleExtend(u.id, "90")}
                                    className="px-1.5 py-0.5 text-[10px] hover:text-white text-slate-400 cursor-pointer border-l border-slate-700"
                                    title="Add 90 days"
                                  >
                                    +90d
                                  </button>
                                </div>

                                {/* Force logout */}
                                <button
                                  type="button"
                                  onClick={() => handleForceLogout(u.id)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 cursor-pointer"
                                  title="Force logout all devices"
                                >
                                  Logout
                                </button>

                                {/* Disable/Enable */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(u.id, u.is_active)}
                                  className={`px-2 py-1 rounded text-[10px] border cursor-pointer ${
                                    u.is_active
                                      ? "bg-amber-600/10 border-amber-600/30 text-amber-300 hover:bg-amber-600/20"
                                      : "bg-emerald-600/10 border-emerald-600/30 text-emerald-300 hover:bg-emerald-600/20"
                                  }`}
                                >
                                  {u.is_active ? "Suspend" : "Enable"}
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => handleDelete(u.id, u.username)}
                                  className="px-2 py-1 rounded bg-rose-600/10 border border-rose-600/30 text-rose-300 hover:bg-rose-600/20 text-[10px] cursor-pointer"
                                  title="Delete user"
                                >
                                  Del
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: AUDIT ACTIVITY LOGS */}
        {/* ================================================================= */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Security & Audit Activity Logs</h2>
                <p className="text-xs text-slate-400">Chronological tamper-evident stream of logins, replacements, and sheet jobs</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={logEventFilter}
                  onChange={(e) => setLogEventFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All Events</option>
                  <option value="login_success">Logins (Success)</option>
                  <option value="login_failed">Logins (Failed)</option>
                  <option value="session_replaced">Session Replaced</option>
                  <option value="upload_sheet">Sheet Uploads</option>
                  <option value="generate_rows">Generated Rows</option>
                  <option value="download_workbook">Workbook Downloads</option>
                  <option value="user_created">User Provisioning</option>
                  <option value="user_disabled">User Suspensions</option>
                </select>
                <button
                  type="button"
                  onClick={fetchLogs}
                  disabled={isLogsLoading}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLogsLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                      <th className="py-3 px-4">Timestamp (UTC)</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Origin IP</th>
                      <th className="py-3 px-4">Client User-Agent</th>
                      <th className="py-3 px-4">Safe Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                          {isLogsLoading ? "Loading logs..." : "No activity logs found for selected filter."}
                        </td>
                      </tr>
                    ) : (
                      logs.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {new Date(l.ts).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">
                            @{l.username}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                              {l.event}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                            {l.ip_address}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[200px] truncate" title={l.user_agent}>
                            {l.user_agent}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-400 font-mono max-w-[240px] truncate">
                            {JSON.stringify(l.details || {})}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================================================================= */}
      {/* MODAL: CREATE SUBSCRIBER */}
      {/* ================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Create Subscriber Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            {createSuccessMsg ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  <div className="font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Account Provisioned!
                  </div>
                  <div className="mt-1 leading-relaxed">{createSuccessMsg}</div>
                </div>

                <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-1.5 font-mono text-xs">
                  <div><span className="text-slate-400">Username:</span> {newUsername}</div>
                  <div><span className="text-slate-400">Password:</span> {newPassword}</div>
                  <div><span className="text-slate-400">Duration:</span> {newDurationDays} Days</div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyCredentials}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
                  >
                    {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey ? "Copied to Clipboard!" : "Copy Credentials"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateSuccessMsg(null);
                      setNewUsername("");
                      generatePassword();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                  >
                    Create Another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="space-y-3.5">
                {createErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{createErrorMsg}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Username (Unique, lowercase alphanumeric)
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                    placeholder="e.g. rajesh_textiles"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Password (Min 4 characters)
                    </label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Auto-generated secure password"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Display Name / Business Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="e.g. Rajesh Textiles Surat"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Access Duration Presets
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[7, 30, 90, 180, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setNewDurationDays(d)}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                          newDurationDays === d
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Administrative Notes (WhatsApp, payment ref, client contact)
                  </label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Paid via UPI, contact +919876543210"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isCreating ? (
                      <span>Creating Account...</span>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Confirm & Issue Credentials</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
