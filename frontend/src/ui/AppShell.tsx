import React, { useState } from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { motion } from "framer-motion";
import {
  Moon,
  Sun,
  LogOut,
  Sparkles,
  FileSpreadsheet,
  Shield,
  RotateCcw,
  Clock,
} from "lucide-react";
import { useAuthStore } from "../auth/authStore";
import { useAppStore } from "../store";
import { useTheme } from "./theme";
import { toast } from "./ToastProvider";

interface AppShellProps {
  title?: string;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ title = "Sheet Filler", children }) => {
  const { user, logout } = useAuthStore();
  const { activeSection, setActiveSection, runStatus, resetAllWorkspaces } = useAppStore();
  const { isDark, toggleTheme } = useTheme();

  // Reset confirmation modal
  const {
    isOpen: isResetModalOpen,
    onOpen: onOpenResetModal,
    onOpenChange: onResetModalChange,
  } = useDisclosure();

  const daysLeft = user?.days_left;
  const isSubscriber = user?.role === "user";
  const isAdmin = user?.role === "admin";
  const isJobRunning = runStatus === "running";

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleConfirmResetAll = () => {
    resetAllWorkspaces();
    toast.success("All local workspaces reset to defaults.", "Workspaces cleared");
  };

  const navItems = [
    ...(isAdmin
      ? [
          {
            key: "admin",
            label: "Admin",
            icon: Shield,
            section: "admin" as const,
          },
        ]
      : []),
    {
      key: "sheets",
      label: "Sheet Filler",
      icon: FileSpreadsheet,
      section: "sheets" as const,
    },
    {
      key: "keyword-agent",
      label: "Keyword Agent",
      icon: Sparkles,
      section: "keyword-agent" as const,
      hasBadge: isJobRunning,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200 relative">
      {/* Ambient Aurora Liquid-Glass Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30 dark:opacity-20 select-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "8s" }}
        />
      </div>

      {/* 56px Top Bar */}
      <Navbar
        isBordered
        maxWidth="full"
        className="h-14 border-b border-divider/60 bg-content1/80 backdrop-blur-xl px-4 sm:px-6 relative z-20"
      >
        {/* Left: Brand & Logo */}
        <NavbarBrand
          className="gap-2.5 max-w-fit cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setActiveSection("sheets")}
        >
          <img src="/logo.svg" alt="SheetFill" className="w-8 h-8 rounded-xl shadow-xs shrink-0" />
          <span className="font-bold text-sm sm:text-base tracking-tight text-foreground hidden sm:inline">
            SheetFill
          </span>
        </NavbarBrand>

        {/* Center: Sliding Segmented Switcher */}
        <NavbarContent justify="center" className="hidden sm:flex">
          <div className="relative flex items-center p-1 rounded-xl bg-default-100/70 dark:bg-default-50/10 border border-divider/70">
            {navItems.map((item) => {
              const isSelected = activeSection === item.section;
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.section)}
                  className={`relative z-10 flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-200 select-none ${
                    isSelected
                      ? "text-foreground"
                      : "text-default-500 hover:text-foreground"
                  }`}
                >
                  {/* Sliding Spring Active Indicator */}
                  {isSelected && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 bg-content1 dark:bg-content2/80 rounded-lg shadow-xs border border-divider/60 -z-10"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}

                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>

                  {/* Pulsating Live Status Dot for Background Keyword Agent Running Job */}
                  {item.hasBadge && (
                    <span className="relative flex h-2 w-2 ml-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </NavbarContent>

        {/* Right: Theme Toggle & Avatar Menu */}
        <NavbarContent justify="end" className="gap-2 sm:gap-3">
          {/* Theme Toggle */}
          <NavbarItem>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Toggle theme"
              onPress={toggleTheme}
              className="text-default-500 hover:text-foreground rounded-xl w-9 h-9"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-default-600" />}
            </Button>
          </NavbarItem>

          {/* User Avatar with Profile, Plan Status & Global Reset */}
          {user && (
            <NavbarItem>
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <button
                    type="button"
                    className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-primary/20 transition-all focus:outline-none"
                    aria-label="Open user menu"
                  >
                    <Avatar
                      size="sm"
                      name={getInitials(user.display_name || user.username)}
                      color="primary"
                      className="cursor-pointer text-xs font-bold w-8 h-8"
                    />
                  </button>
                </DropdownTrigger>
                <DropdownMenu aria-label="User actions" variant="flat" className="w-60">
                  <DropdownItem key="profile" textValue="User info" className="h-14 gap-2 cursor-default opacity-90" isReadOnly>
                    <p className="font-semibold text-xs text-foreground truncate">
                      {user.display_name || user.username}
                    </p>
                    <p className="text-[11px] text-default-400 font-mono">
                      @{user.username} {isAdmin ? "(Admin)" : ""}
                    </p>
                  </DropdownItem>

                  <DropdownItem
                    key="subscription-status"
                    textValue="Subscription"
                    isReadOnly
                    startContent={<Clock className="w-4 h-4 text-primary" />}
                    className={isSubscriber && typeof daysLeft === "number" ? "cursor-default" : "hidden"}
                  >
                    <div className="flex flex-col">
                      <span className="text-[11px] text-default-400">Subscription Status</span>
                      <span className="text-xs font-semibold text-foreground">
                        {daysLeft === 0 ? "Expires today" : `${daysLeft} days remaining`}
                      </span>
                    </div>
                  </DropdownItem>

                  <DropdownItem
                    key="nav-sheets"
                    className="sm:hidden"
                    textValue="Sheet Filler"
                    startContent={<FileSpreadsheet className="w-4 h-4 text-primary" />}
                    onPress={() => setActiveSection("sheets")}
                  >
                    Sheet Filler
                  </DropdownItem>

                  <DropdownItem
                    key="nav-keyword"
                    className="sm:hidden"
                    textValue="Keyword Agent"
                    startContent={<Sparkles className="w-4 h-4 text-secondary" />}
                    onPress={() => setActiveSection("keyword-agent")}
                  >
                    {`Keyword Agent ${isJobRunning ? "(Active Job)" : ""}`}
                  </DropdownItem>

                  <DropdownItem
                    key="nav-admin"
                    className={isAdmin ? "sm:hidden" : "hidden"}
                    textValue="Admin Dashboard"
                    startContent={<Shield className="w-4 h-4 text-warning" />}
                    onPress={() => setActiveSection("admin")}
                  >
                    Admin Dashboard
                  </DropdownItem>

                  <DropdownItem
                    key="reset-all"
                    textValue="Reset All Workspaces"
                    startContent={<RotateCcw className="w-4 h-4 text-amber-500" />}
                    onPress={onOpenResetModal}
                  >
                    Reset All Workspaces
                  </DropdownItem>

                  <DropdownItem
                    key="logout"
                    color="danger"
                    textValue="Log out"
                    startContent={<LogOut className="w-4 h-4" />}
                    onPress={() => logout()}
                  >
                    Log out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          )}
        </NavbarContent>
      </Navbar>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-background relative z-10">{children}</main>

      {/* Global Reset All Confirmation Modal */}
      <Modal isOpen={isResetModalOpen} onOpenChange={onResetModalChange} size="sm">
        <ModalContent className="rounded-2xl border border-divider bg-content1 shadow-2xl">
          {(onClose) => (
            <>
              <ModalHeader className="text-base font-bold border-b border-divider py-3.5 px-5">
                Reset all local workspaces?
              </ModalHeader>
              <ModalBody className="text-sm text-default-600 p-5 leading-relaxed">
                This will clear both your uploaded Flipkart sheet progress and generated AI keyword research from this browser session.
              </ModalBody>
              <ModalFooter className="border-t border-divider py-3.5 px-5 flex items-center justify-end gap-2">
                <Button size="sm" variant="light" onPress={onClose} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  className="rounded-xl font-medium"
                  onPress={() => {
                    handleConfirmResetAll();
                    onClose();
                  }}
                >
                  Reset All Workspaces
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
