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
import { Moon, Sun, LogOut, Sparkles } from "lucide-react";
import { useAuthStore } from "../auth/authStore";
import { useTheme } from "./theme";

interface AppShellProps {
  title?: string;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ title = "Sheet Filler", children }) => {
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useTheme();

  const daysLeft = user?.days_left;
  const isSubscriber = user?.role === "user";

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
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* 56px Top Bar */}
      <Navbar
        isBordered
        maxWidth="full"
        className="h-14 border-b border-divider bg-content1/90 backdrop-blur-md px-4 sm:px-6"
      >
        <NavbarBrand className="gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm sm:text-base tracking-tight text-foreground">
            {title}
          </span>
        </NavbarBrand>

        <NavbarContent justify="end" className="gap-2.5 sm:gap-3">
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
                  <DropdownItem key="profile" textValue="User info" className="h-14 gap-2 cursor-default opacity-90" isReadOnly>
                    <p className="font-semibold text-xs text-foreground">
                      {user.display_name || user.username}
                    </p>
                    <p className="text-[11px] text-default-400 font-mono">
                      @{user.username} {user.role === "admin" && "(Admin)"}
                    </p>
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
      <main className="flex-1 flex flex-col bg-background">{children}</main>
    </div>
  );
};
