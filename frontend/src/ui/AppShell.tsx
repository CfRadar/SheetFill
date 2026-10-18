import React from "react";
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
  Chip,
  Button,
} from "@heroui/react";
import { Moon, Sun, LogOut, Sparkles, FileSpreadsheet, Shield, ExternalLink } from "lucide-react";
import { useAuthStore } from "../auth/authStore";
import { useAppStore } from "../store";
import { useTheme } from "./theme";

interface AppShellProps {
  title?: string;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ title = "Sheet Filler", children }) => {
  const { user, logout } = useAuthStore();
  const { activeSection, setActiveSection } = useAppStore();
  const { isDark, toggleTheme } = useTheme();

  const daysLeft = user?.days_left;
  const isSubscriber = user?.role === "user";
  const isAdmin = user?.role === "admin";

  const getDaysChipColor = (days: number): "success" | "warning" | "danger" => {
    if (days <= 2) return "danger";
    if (days <= 7) return "warning";
    return "success";
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200 relative">
      {/* Ambient Aurora Liquid-Glass Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30 dark:opacity-20 select-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />
      </div>

      {/* 56px Top Bar */}
      <Navbar
        isBordered
        maxWidth="full"
        className="h-14 border-b border-divider/60 bg-content1/80 backdrop-blur-xl px-3 sm:px-6 relative z-10"
      >
        {/* Brand & Logo */}
        <NavbarBrand
          className="gap-2.5 max-w-fit cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setActiveSection("sheets")}
        >
          <img src="/logo.svg" alt="SheetFill" className="w-8 h-8 rounded-lg shadow-xs shrink-0" />
          <span className="font-semibold text-sm sm:text-base tracking-tight text-foreground hidden md:inline">
            SheetFill
          </span>
        </NavbarBrand>

        {/* Section Navigation Switcher (Desktop) */}
        <NavbarContent justify="center" className="hidden sm:flex gap-1.5 bg-default-100/60 dark:bg-default-100/10 p-1 rounded-xl border border-divider/60">
          {isAdmin && (
            <Button
              size="sm"
              variant={activeSection === "admin" ? "solid" : "light"}
              color={activeSection === "admin" ? "primary" : "default"}
              className={`h-7 px-3 text-xs font-medium rounded-lg ${
                activeSection === "admin" ? "shadow-2xs font-semibold" : "text-default-600"
              }`}
              onPress={() => setActiveSection("admin")}
              startContent={<Shield className="w-3.5 h-3.5" />}
            >
              Admin
            </Button>
          )}

          <Button
            size="sm"
            variant={activeSection === "sheets" ? "solid" : "light"}
            color={activeSection === "sheets" ? "primary" : "default"}
            className={`h-7 px-3 text-xs font-medium rounded-lg ${
              activeSection === "sheets" ? "shadow-2xs font-semibold" : "text-default-600"
            }`}
            onPress={() => setActiveSection("sheets")}
            startContent={<FileSpreadsheet className="w-3.5 h-3.5" />}
          >
            Sheet Filler
          </Button>

          <Button
            size="sm"
            variant={activeSection === "keyword-agent" ? "solid" : "light"}
            color={activeSection === "keyword-agent" ? "primary" : "default"}
            className={`h-7 px-3 text-xs font-medium rounded-lg ${
              activeSection === "keyword-agent" ? "shadow-2xs font-semibold" : "text-default-600"
            }`}
            onPress={() => setActiveSection("keyword-agent")}
            startContent={<Sparkles className="w-3.5 h-3.5" />}
          >
            Keyword Agent
          </Button>
        </NavbarContent>

        <NavbarContent justify="end" className="gap-2 sm:gap-3">
          {/* Days Left Chip (Subscribers only) */}
          {isSubscriber && typeof daysLeft === "number" && (
            <NavbarItem>
              <Chip
                size="sm"
                color={getDaysChipColor(daysLeft)}
                variant="flat"
                className="h-6 text-[11px] font-semibold border border-divider"
              >
                {daysLeft === 0 ? "Expires today" : `${daysLeft} days left`}
              </Chip>
            </NavbarItem>
          )}

          {/* Theme Toggle */}
          <NavbarItem>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Toggle theme"
              onPress={toggleTheme}
              className="text-default-500 hover:text-foreground rounded-[10px]"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-default-600" />}
            </Button>
          </NavbarItem>

          {/* User Menu */}
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
                      className="cursor-pointer text-xs font-bold"
                    />
                  </button>
                </DropdownTrigger>
                <DropdownMenu aria-label="User actions" variant="flat">
                  {[
                    <DropdownItem key="profile" textValue="User info" className="h-14 gap-2 cursor-default opacity-90" isReadOnly>
                      <p className="font-semibold text-xs text-foreground">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-[11px] text-default-400 font-mono">
                        @{user.username} {user.role === "admin" && "(Admin)"}
                      </p>
                    </DropdownItem>,

                    <DropdownItem
                      key="nav-sheets"
                      className="sm:hidden"
                      textValue="Sheet Filler"
                      startContent={<FileSpreadsheet className="w-4 h-4 text-primary" />}
                      onPress={() => setActiveSection("sheets")}
                    >
                      Sheet Filler
                    </DropdownItem>,

                    <DropdownItem
                      key="nav-keyword"
                      className="sm:hidden"
                      textValue="Keyword Agent"
                      startContent={<Sparkles className="w-4 h-4 text-secondary" />}
                      onPress={() => setActiveSection("keyword-agent")}
                    >
                      Keyword Agent
                    </DropdownItem>,

                    ...(isAdmin
                      ? [
                          <DropdownItem
                            key="nav-admin"
                            className="sm:hidden"
                            textValue="Admin Dashboard"
                            startContent={<Shield className="w-4 h-4 text-warning" />}
                            onPress={() => setActiveSection("admin")}
                          >
                            Admin Dashboard
                          </DropdownItem>,
                        ]
                      : []),

                    <DropdownItem
                      key="logout"
                      color="danger"
                      textValue="Log out"
                      startContent={<LogOut className="w-4 h-4" />}
                      onPress={() => logout()}
                    >
                      Log out
                    </DropdownItem>,
                  ]}
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          )}
        </NavbarContent>
      </Navbar>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-background">{children}</main>
    </div>
  );
};
