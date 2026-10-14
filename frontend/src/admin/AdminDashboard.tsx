import React, { useEffect, useState, useCallback } from "react";
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Skeleton,
  Chip,
  Tooltip,
} from "@heroui/react";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Radio,
  Plus,
  Search,
  RefreshCw,
  MoreVertical,
  Clock,
  Activity,
  Copy,
  Check,
  ShieldAlert,
} from "lucide-react";
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
import { StatusChip } from "../ui/StatusChip";
import { toast } from "../ui/ToastProvider";
import { PageFade } from "../ui/PageFade";

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Stats State
  const [stats, setStats] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  // Activity Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [logEventFilter, setLogEventFilter] = useState("");
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Create User Modal State
  const {
    isOpen: isCreateOpen,
    onOpen: onOpenCreate,
    onOpenChange: onCreateOpenChange,
  } = useDisclosure();
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDurationDays, setNewDurationDays] = useState(30);
  const [newNotes, setNewNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccessData, setCreateSuccessData] = useState<{
    username: string;
    pass: string;
    days: number;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [customExtendUser, setCustomExtendUser] = useState<any | null>(null);
  const [customExtendDays, setCustomExtendDays] = useState<number>(30);

  // Action Confirmation Modal State
  const {
    isOpen: isConfirmOpen,
    onOpen: onOpenConfirm,
    onOpenChange: onConfirmOpenChange,
  } = useDisclosure();
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    danger?: boolean;
    actionLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isActionExecuting, setIsActionExecuting] = useState(false);

  // =========================================================================
  // API Fetchers
  // =========================================================================

  const fetchStats = useCallback(async (quiet = false) => {
    if (!quiet) setIsStatsLoading(true);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err: any) {
      console.error("Failed to load stats", err);
    } finally {
      if (!quiet) setIsStatsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
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
    } catch (err: any) {
      toast.error(err?.message || "Failed to load users");
    } finally {
      setIsUsersLoading(false);
    }
  }, [search, statusFilter, page]);

  const fetchLogs = useCallback(async () => {
    setIsLogsLoading(true);
    try {
      const data = await getAdminActivity({
        event: logEventFilter || undefined,
        limit: 50,
      });
      setLogs(data.items || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load activity logs");
    } finally {
      setIsLogsLoading(false);
    }
  }, [logEventFilter]);

  // Tab switching triggers
  useEffect(() => {
    if (activeTab === "overview") fetchStats();
    if (activeTab === "users") fetchUsers();
    if (activeTab === "activity") fetchLogs();
  }, [activeTab, fetchStats, fetchUsers, fetchLogs]);

  // Silent 15s polling for Overview stats
  useEffect(() => {
    if (activeTab !== "overview") return;
    const interval = setInterval(() => {
      fetchStats(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab, fetchStats]);

  // =========================================================================
  // Action Handlers
  // =========================================================================

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let p = "";
    for (let i = 0; i < 12; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(p);
  };

  const handleOpenCreateModal = () => {
    generatePassword();
    setNewUsername("");
    setNewDisplayName("");
    setNewNotes("");
    setNewDurationDays(30);
    setCreateSuccessData(null);
    onOpenCreate();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;

    setIsCreating(true);
    try {
      await createAdminUser({
        username: newUsername.trim().toLowerCase(),
        password: newPassword,
        display_name: newDisplayName.trim() || undefined,
        duration_days: newDurationDays,
        notes: newNotes.trim() || undefined,
      });

      setCreateSuccessData({
        username: newUsername.trim().toLowerCase(),
        pass: newPassword,
        days: newDurationDays,
      });
      toast.success(`User '${newUsername}' provisioned successfully.`);
      fetchUsers();
      fetchStats(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  };

  const copyCredentials = () => {
    if (!createSuccessData) return;
    const text = `Flipkart Sheet Filler Access\nUsername: ${createSuccessData.username}\nPassword: ${createSuccessData.pass}\nDuration: ${createSuccessData.days} Days\nLink: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleExtend = async (uid: string, days: string) => {
    try {
      await updateAdminUser(uid, { extension: `+${days}d` });
      toast.success(`Extended subscriber access by ${days} days.`);
      fetchUsers();
      fetchStats(true);
    } catch (err: any) {
      toast.error(err.message || "Extension failed");
    }
  };

  const promptToggleActive = (userItem: any) => {
    const isActivating = !userItem.is_active;
    setConfirmConfig({
      title: isActivating ? "Enable account" : "Suspend account",
      message: isActivating
        ? `Re-enable account @${userItem.username}? The subscriber will be allowed to log in.`
        : `Suspend account @${userItem.username}? All active sessions will be terminated immediately.`,
      danger: !isActivating,
      actionLabel: isActivating ? "Enable" : "Suspend",
      onConfirm: async () => {
        if (userItem.is_active) {
          await disableAdminUser(userItem.id);
          toast.success(`Account @${userItem.username} suspended.`);
        } else {
          await enableAdminUser(userItem.id);
          toast.success(`Account @${userItem.username} enabled.`);
        }
        fetchUsers();
        fetchStats(true);
      },
    });
    onOpenConfirm();
  };

  const promptForceLogout = (userItem: any) => {
    setConfirmConfig({
      title: "Force logout user",
      message: `Revoke all active device sessions for @${userItem.username}? The user will be required to log in again.`,
      danger: false,
      actionLabel: "Force logout",
      onConfirm: async () => {
        await forceLogoutAdminUser(userItem.id);
        toast.success(`Revoked all active sessions for @${userItem.username}.`);
        fetchUsers();
      },
    });
    onOpenConfirm();
  };

  const promptDeleteUser = (userItem: any) => {
    setConfirmConfig({
      title: "Delete subscriber account",
      message: `Permanently delete @${userItem.username}? This action is irreversible.`,
      danger: true,
      actionLabel: "Delete permanently",
      onConfirm: async () => {
        await deleteAdminUser(userItem.id);
        toast.success(`User @${userItem.username} permanently deleted.`);
        fetchUsers();
        fetchStats(true);
      },
    });
    onOpenConfirm();
  };

  const executeConfirmedAction = async (onCloseModal: () => void) => {
    if (!confirmConfig) return;
    try {
      setIsActionExecuting(true);
      await confirmConfig.onConfirm();
      onCloseModal();
    } catch (err: any) {
      toast.error(err?.message || "Action failed");
    } finally {
      setIsActionExecuting(false);
    }
  };

  return (
    <PageFade className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-divider pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Admin & Access Control</h2>
          <p className="text-xs text-default-500 mt-0.5">
            Subscriber provisioning, session management, and tamper-evident audit logs
          </p>
        </div>

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(String(k))}
          variant="solid"
          color="primary"
          size="sm"
          aria-label="Admin navigation tabs"
        >
          <Tab
            key="overview"
            title={
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                <span>Overview</span>
              </div>
            }
          />
          <Tab
            key="users"
            title={
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                <span>Users ({usersTotal})</span>
              </div>
            }
          />
          <Tab
            key="activity"
            title={
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>Activity</span>
              </div>
            }
          />
        </Tabs>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: OVERVIEW */}
      {/* =================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">System metrics</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="flat"
                startContent={
                  <RefreshCw className={`w-3.5 h-3.5 ${isStatsLoading ? "animate-spin" : ""}`} />
                }
                onPress={() => fetchStats()}
                isDisabled={isStatsLoading}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                color="primary"
                startContent={<Plus className="w-3.5 h-3.5" />}
                onPress={handleOpenCreateModal}
                className="font-medium"
              >
                Create user
              </Button>
            </div>
          </div>

          {/* 6 Metric Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Total Subscribers */}
            <Card shadow="none" className="border border-divider bg-content1 rounded-[14px] hover:border-default-300 transition-colors">
              <CardBody className="p-4 sm:p-5">
                <div className="flex flex-row items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-[12px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-default-500">Total subscribers</div>
                    <Skeleton isLoaded={!isStatsLoading} className="rounded-lg mt-0.5 w-fit">
                      <div className="text-2xl font-bold tracking-tight text-foreground">
                        {stats ? stats.total_users : "—"}
                      </div>
                    </Skeleton>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* 2. Active Subscriptions */}
            <Card shadow="none" className="border border-divider bg-content1 rounded-[14px] hover:border-default-300 transition-colors">
              <CardBody className="p-4 sm:p-5">
                <div className="flex flex-row items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-[12px] bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-default-500">Active subscriptions</div>
                    <Skeleton isLoaded={!isStatsLoading} className="rounded-lg mt-0.5 w-fit">
                      <div className="text-2xl font-bold tracking-tight text-emerald-500">
                        {stats ? stats.active_subscriptions : "—"}
                      </div>
                    </Skeleton>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* 3. Expiring Soon */}
            <Card shadow="none" className="border border-divider bg-content1 rounded-[14px] hover:border-default-300 transition-colors">
              <CardBody className="p-4 sm:p-5">
                <div className="flex flex-row items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-[12px] bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-default-500">Expiring in 7 days</div>
                    <Skeleton isLoaded={!isStatsLoading} className="rounded-lg mt-0.5 w-fit">
                      <div className="text-2xl font-bold tracking-tight text-amber-500">
                        {stats ? stats.expiring_soon : "—"}
                      </div>
                    </Skeleton>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* 4. Expired Accounts */}
            <Card shadow="none" className="border border-divider bg-content1 rounded-[14px] hover:border-default-300 transition-colors">
              <CardBody className="p-4 sm:p-5">
                <div className="flex flex-row items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-[12px] bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-default-500">Expired accounts</div>
                    <Skeleton isLoaded={!isStatsLoading} className="rounded-lg mt-0.5 w-fit">
                      <div className="text-2xl font-bold tracking-tight text-rose-500">
                        {stats ? stats.expired : "—"}
                      </div>
                    </Skeleton>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* 5. Online Now */}
            <Card shadow="none" className="border border-divider bg-content1 rounded-[14px] hover:border-default-300 transition-colors">
              <CardBody className="p-4 sm:p-5">
                <div className="flex flex-row items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-[12px] bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-default-500">Online now</div>
                    <Skeleton isLoaded={!isStatsLoading} className="rounded-lg mt-0.5 w-fit">
                      <div className="text-2xl font-bold tracking-tight text-emerald-500">
                        {stats ? stats.online_now : "—"}
                      </div>
                    </Skeleton>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* 6. Logins Today */}
            <Card shadow="none" className="border border-divider bg-content1 rounded-[14px] hover:border-default-300 transition-colors">
              <CardBody className="p-4 sm:p-5">
                <div className="flex flex-row items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-[12px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-default-500">Logins today</div>
                    <Skeleton isLoaded={!isStatsLoading} className="rounded-lg mt-0.5 w-fit">
                      <div className="text-2xl font-bold tracking-tight text-foreground">
                        {stats ? stats.logins_today : "—"}
                      </div>
                    </Skeleton>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: USERS */}
      {/* =================================================================== */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <Input
                size="sm"
                placeholder="Search username, name, notes..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                startContent={<Search className="w-3.5 h-3.5 text-default-400" />}
                isClearable
                onClear={() => {
                  setSearch("");
                  setPage(1);
                }}
                aria-label="Search subscribers"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                size="sm"
                selectedKeys={[statusFilter]}
                onChange={(e) => {
                  setStatusFilter(e.target.value || "all");
                  setPage(1);
                }}
                className="w-36"
                aria-label="Filter status"
              >
                <SelectItem key="all">All statuses</SelectItem>
                <SelectItem key="active">Active only</SelectItem>
                <SelectItem key="expired">Expired only</SelectItem>
                <SelectItem key="disabled">Disabled only</SelectItem>
              </Select>

              <Button
                size="sm"
                variant="flat"
                isIconOnly
                onPress={() => fetchUsers()}
                isDisabled={isUsersLoading}
                aria-label="Refresh user list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUsersLoading ? "animate-spin" : ""}`} />
              </Button>

              <Button
                size="sm"
                color="primary"
                startContent={<Plus className="w-3.5 h-3.5" />}
                onPress={handleOpenCreateModal}
                className="font-medium shrink-0"
              >
                Create user
              </Button>
            </div>
          </div>

          {/* Subscribers Table */}
          <Card shadow="none" className="border border-divider bg-content1 rounded-[14px] overflow-hidden">
            <Table
              aria-label="Subscribers list table"
              classNames={{
                wrapper: "p-0 shadow-none bg-transparent",
                th: "bg-content2/70 text-default-400 font-semibold text-[11px] uppercase tracking-wider py-3 border-b border-divider",
                td: "py-3 text-xs border-b border-divider/40 group-hover:bg-content2/20 transition-colors",
              }}
            >
              <TableHeader>
                <TableColumn>Subscriber</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Access expiry</TableColumn>
                <TableColumn>Last login</TableColumn>
                <TableColumn>Notes</TableColumn>
                <TableColumn align="end">Actions</TableColumn>
              </TableHeader>
              <TableBody
                isLoading={isUsersLoading}
                emptyContent="No subscriber accounts found."
              >
                {users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-content2/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-[11px]">
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          {u.is_online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border-2 border-content1 rounded-full animate-pulse" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{u.display_name}</div>
                          <div className="text-[11px] text-default-400 font-mono">@{u.username}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <StatusChip status={u.status} size="sm" />
                    </TableCell>

                    <TableCell>
                      {u.access_expires_at ? (
                        <div>
                          <div className="text-foreground">
                            {new Date(u.access_expires_at).toLocaleDateString()}
                          </div>
                          <div
                            className={`text-[11px] font-medium ${
                              u.days_left && u.days_left <= 7 ? "text-warning font-bold" : "text-default-400"
                            }`}
                          >
                            {u.days_left !== null ? `${u.days_left}d left` : "Expired"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-default-400">Unlimited</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="text-default-500">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Never"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-default-400 max-w-[180px] truncate block" title={u.notes}>
                        {u.notes || "—"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end">
                        <Dropdown placement="bottom-end">
                          <DropdownTrigger>
                            <Button size="sm" isIconOnly variant="light" aria-label="Subscriber actions">
                              <MoreVertical className="w-4 h-4 text-default-400" />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu
                            aria-label={`Actions for ${u.username}`}
                            onAction={(key) => {
                              if (key === "ext-7") handleExtend(u.id, "7");
                              if (key === "ext-30") handleExtend(u.id, "30");
                              if (key === "ext-90") handleExtend(u.id, "90");
                              if (key === "ext-custom") {
                                setCustomExtendUser(u);
                                setCustomExtendDays(30);
                              }
                              if (key === "logout") promptForceLogout(u);
                              if (key === "toggle-status") promptToggleActive(u);
                              if (key === "delete") promptDeleteUser(u);
                            }}
                          >
                            <DropdownItem key="ext-7">Add 7 days access</DropdownItem>
                            <DropdownItem key="ext-30">Add 30 days access</DropdownItem>
                            <DropdownItem key="ext-90">Add 90 days access</DropdownItem>
                            <DropdownItem key="ext-custom">Add custom days...</DropdownItem>
                            <DropdownItem key="logout">Force logout devices</DropdownItem>
                            <DropdownItem key="toggle-status">
                              {u.is_active ? "Suspend account" : "Enable account"}
                            </DropdownItem>
                            <DropdownItem key="delete" className="text-danger" color="danger">
                              Delete account
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {usersTotal > 20 && (
            <div className="flex justify-center pt-2">
              <Pagination
                total={Math.ceil(usersTotal / 20)}
                page={page}
                onChange={setPage}
                color="primary"
                size="sm"
              />
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: ACTIVITY */}
      {/* =================================================================== */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Audit log stream</h3>
              <p className="text-xs text-default-400">
                Tamper-evident record of security events and sheet operations
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Select
                size="sm"
                selectedKeys={[logEventFilter]}
                onChange={(e) => setLogEventFilter(e.target.value)}
                className="w-48"
                aria-label="Filter activity event"
              >
                <SelectItem key="">All events</SelectItem>
                <SelectItem key="login_success">Logins (Success)</SelectItem>
                <SelectItem key="login_failed">Logins (Failed)</SelectItem>
                <SelectItem key="session_replaced">Session replaced</SelectItem>
                <SelectItem key="upload_sheet">Sheet uploads</SelectItem>
                <SelectItem key="generate_rows">Generated rows</SelectItem>
                <SelectItem key="download_workbook">Workbook downloads</SelectItem>
                <SelectItem key="user_created">User provisioned</SelectItem>
                <SelectItem key="user_disabled">User suspended</SelectItem>
              </Select>

              <Button
                size="sm"
                variant="flat"
                isIconOnly
                onPress={() => fetchLogs()}
                isDisabled={isLogsLoading}
                aria-label="Refresh activity logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLogsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Activity Table */}
          <Card shadow="none" className="border border-divider bg-content1 rounded-[14px] overflow-hidden">
            <Table
              aria-label="Activity logs table"
              classNames={{
                wrapper: "p-0 shadow-none bg-transparent",
                th: "bg-content2/70 text-default-400 font-semibold text-[11px] uppercase tracking-wider py-3 border-b border-divider",
                td: "py-3 text-xs border-b border-divider/40 group-hover:bg-content2/20 transition-colors",
              }}
            >
              <TableHeader>
                <TableColumn>Timestamp</TableColumn>
                <TableColumn>User</TableColumn>
                <TableColumn>Event</TableColumn>
                <TableColumn>IP Address</TableColumn>
                <TableColumn>User Agent</TableColumn>
                <TableColumn>Details</TableColumn>
              </TableHeader>
              <TableBody isLoading={isLogsLoading} emptyContent="No activity logs found.">
                {logs.map((l) => (
                  <TableRow key={l.id} className="hover:bg-content2/30 transition-colors">
                    <TableCell>
                      <span className="font-mono text-default-500 whitespace-nowrap text-[11px]">
                        {new Date(l.ts).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-semibold text-foreground">@{l.username}</span>
                    </TableCell>

                    <TableCell>
                      <Chip size="sm" variant="flat" color="default" className="text-[11px] font-mono">
                        {l.event}
                      </Chip>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-default-500 text-[11px]">{l.ip_address}</span>
                    </TableCell>

                    <TableCell>
                      <span className="text-default-400 max-w-[180px] truncate block text-[11px]" title={l.user_agent}>
                        {l.user_agent}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-default-400 max-w-[200px] truncate block text-[11px]" title={JSON.stringify(l.details || {})}>
                        {JSON.stringify(l.details || {})}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE SUBSCRIBER */}
      {/* =================================================================== */}
      <Modal
        isOpen={isCreateOpen}
        onOpenChange={onCreateOpenChange}
        size="md"
        backdrop="blur"
        classNames={{
          base: "rounded-[14px] border border-divider bg-content1 shadow-xl",
          header: "border-b border-divider py-4 px-6",
          body: "p-6",
          footer: "border-t border-divider py-3.5 px-6",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center text-primary">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Create subscriber account</h3>
                  <p className="text-xs text-default-400 font-normal">Issue credentials with expiration</p>
                </div>
              </ModalHeader>

              <ModalBody className="p-6">
                {createSuccessData ? (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800 text-success-800 dark:text-success-200 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-success" />
                      <span>Account provisioned with {createSuccessData.days} days access!</span>
                    </div>

                    <div className="p-3 bg-content2 rounded-xl border border-divider font-mono text-xs space-y-1">
                      <div>
                        <span className="text-default-400">Username:</span>{" "}
                        <strong className="text-foreground">{createSuccessData.username}</strong>
                      </div>
                      <div>
                        <span className="text-default-400">Password:</span>{" "}
                        <strong className="text-foreground">{createSuccessData.pass}</strong>
                      </div>
                      <div>
                        <span className="text-default-400">Duration:</span>{" "}
                        <strong className="text-foreground">{createSuccessData.days} days</strong>
                      </div>
                    </div>

                    <Button
                      color="primary"
                      className="w-full font-semibold"
                      startContent={copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      onPress={copyCredentials}
                    >
                      {copiedKey ? "Copied to clipboard!" : "Copy credentials"}
                    </Button>
                  </div>
                ) : (
                  <form id="create-user-form" onSubmit={handleCreateSubmit} className="space-y-3.5">
                    <Input
                      label="Username"
                      labelPlacement="outside"
                      placeholder="e.g. rajesh_textiles"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                      isRequired
                      size="sm"
                      aria-label="Username"
                    />

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">Password</span>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          Auto-generate
                        </button>
                      </div>
                      <Input
                        placeholder="Auto-generated password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        isRequired
                        minLength={4}
                        size="sm"
                        aria-label="Password"
                      />
                    </div>

                    <Input
                      label="Display name / Business name"
                      labelPlacement="outside"
                      placeholder="e.g. Rajesh Textiles Surat"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      size="sm"
                      aria-label="Display name"
                    />

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-foreground">
                          Access duration
                        </span>
                        <span className="text-[11px] text-default-400 font-mono">
                          {newDurationDays > 0 ? `${newDurationDays} days` : "Custom"}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                        {[7, 30, 90, 180, 365].map((d) => (
                          <Button
                            key={d}
                            size="sm"
                            variant={newDurationDays === d ? "solid" : "flat"}
                            color={newDurationDays === d ? "primary" : "default"}
                            onPress={() => setNewDurationDays(d)}
                            className="font-semibold text-xs rounded-[8px]"
                          >
                            {d}d
                          </Button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-default-400 whitespace-nowrap">Or custom:</span>
                        <Input
                          type="number"
                          size="sm"
                          min={1}
                          max={3650}
                          placeholder="e.g. 15, 45, 60"
                          value={newDurationDays > 0 ? String(newDurationDays) : ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              setNewDurationDays(Math.max(1, Math.min(val, 3650)));
                            } else {
                              setNewDurationDays(0);
                            }
                          }}
                          endContent={<span className="text-xs text-default-400">days</span>}
                          className="flex-1"
                          aria-label="Custom access duration in days"
                        />
                      </div>
                    </div>

                    <Input
                      label="Administrative notes (WhatsApp, payment ref)"
                      labelPlacement="outside"
                      placeholder="e.g. Paid via UPI, contact +919876543210"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      size="sm"
                      aria-label="Notes"
                    />
                  </form>
                )}
              </ModalBody>

              <ModalFooter className="border-t border-divider py-3 px-6">
                <Button size="sm" variant="light" onPress={onClose}>
                  {createSuccessData ? "Done" : "Cancel"}
                </Button>
                {!createSuccessData && (
                  <Button
                    size="sm"
                    color="primary"
                    type="submit"
                    form="create-user-form"
                    isLoading={isCreating}
                    className="font-semibold"
                  >
                    Confirm & issue
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL: CUSTOM EXTENSION */}
      {/* =================================================================== */}
      <Modal
        isOpen={!!customExtendUser}
        onOpenChange={(open) => !open && setCustomExtendUser(null)}
        size="sm"
        backdrop="blur"
        classNames={{
          base: "rounded-[14px] border border-divider bg-content1 shadow-xl",
          header: "border-b border-divider py-4 px-6",
          body: "p-6 space-y-4",
          footer: "border-t border-divider py-3.5 px-6",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center text-primary">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Extend access</h3>
                  <p className="text-xs text-default-400 font-normal">
                    @{customExtendUser?.username} ({customExtendUser?.display_name || "Subscriber"})
                  </p>
                </div>
              </ModalHeader>

              <ModalBody>
                <div className="space-y-3.5">
                  <div>
                    <span className="text-xs font-medium text-foreground block mb-1.5">
                      Quick presets
                    </span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[7, 14, 30, 60, 90].map((d) => (
                        <Button
                          key={d}
                          size="sm"
                          variant={customExtendDays === d ? "solid" : "flat"}
                          color={customExtendDays === d ? "primary" : "default"}
                          onPress={() => setCustomExtendDays(d)}
                          className="font-semibold text-xs rounded-[8px]"
                        >
                          +{d}d
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-foreground block mb-1.5">
                      Custom days to add
                    </span>
                    <Input
                      type="number"
                      size="sm"
                      min={1}
                      max={3650}
                      placeholder="e.g. 15, 45, 120"
                      value={customExtendDays > 0 ? String(customExtendDays) : ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          setCustomExtendDays(Math.max(1, Math.min(val, 3650)));
                        } else {
                          setCustomExtendDays(0);
                        }
                      }}
                      endContent={<span className="text-xs text-default-400">days</span>}
                      aria-label="Custom days to extend"
                    />
                  </div>
                </div>
              </ModalBody>

              <ModalFooter className="flex items-center justify-end gap-2">
                <Button size="sm" variant="light" onPress={onClose} className="rounded-[10px] text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  isDisabled={!customExtendDays || customExtendDays <= 0}
                  onPress={async () => {
                    if (customExtendUser && customExtendDays > 0) {
                      await handleExtend(customExtendUser.id, String(customExtendDays));
                      onClose();
                    }
                  }}
                  className="rounded-[10px] text-xs font-semibold px-4 h-9"
                >
                  Add {customExtendDays || 0} days
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL: ACTION CONFIRMATION (Delete, Force Logout, Suspend) */}
      {/* =================================================================== */}
      <Modal
        isOpen={isConfirmOpen}
        onOpenChange={onConfirmOpenChange}
        size="sm"
        backdrop="blur"
        classNames={{
          base: "rounded-[14px] border border-divider bg-content1 shadow-xl",
          header: "border-b border-divider py-4 px-6",
          body: "p-6",
          footer: "border-t border-divider py-3 px-6",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-base font-semibold text-foreground">
                {confirmConfig?.title || "Confirm action"}
              </ModalHeader>
              <ModalBody className="text-xs text-default-500 leading-relaxed">
                {confirmConfig?.message}
              </ModalBody>
              <ModalFooter>
                <Button size="sm" variant="light" onPress={onClose} className="rounded-[10px] text-xs font-medium">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color={confirmConfig?.danger ? "danger" : "primary"}
                  isLoading={isActionExecuting}
                  onPress={() => executeConfirmedAction(onClose)}
                  className="rounded-[10px] text-xs font-semibold px-4 h-9"
                >
                  {confirmConfig?.actionLabel || "Confirm"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </PageFade>
  );
};
