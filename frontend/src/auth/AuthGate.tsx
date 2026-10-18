import React, { useEffect } from "react";
import { useAuthStore } from "./authStore";
import { useAppStore } from "../store";
import { LoginPage } from "./LoginPage";
import { AdminDashboard } from "../admin/AdminDashboard";
import { AppShell } from "../ui/AppShell";
import { KeywordAgentPage } from "../features/keyword-agent";

interface Props {
  children: React.ReactNode;
}

export const AuthGate: React.FC<Props> = ({ children }) => {
  const { token, user, checkSession } = useAuthStore();
  const { activeSection, setActiveSection } = useAppStore();

  // Periodic session watcher: poll every 60s and on window focus
  useEffect(() => {
    if (!token) return;

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
  }, [token, checkSession]);

  // Set default section for admin on first load
  useEffect(() => {
    if (user?.role === "admin" && activeSection === "sheets") {
      setActiveSection("admin");
    }
  }, [user?.role, activeSection, setActiveSection]);

  // 1. Unauthenticated: render unified Login Page
  if (!token || !user) {
    return <LoginPage />;
  }

  // 2. Determine AppShell title
  const title =
    activeSection === "admin"
      ? "Admin Dashboard"
      : activeSection === "keyword-agent"
      ? "Marketplace Keyword Agent"
      : "Flipkart Sheet Filler";

  // 3. Render views with persistent DOM mounting so tab switching preserves scroll & input state
  return (
    <AppShell title={title}>
      {user.role === "admin" && (
        <div className={activeSection === "admin" ? "w-full flex-1 flex flex-col" : "hidden"}>
          <AdminDashboard />
        </div>
      )}
      <div className={activeSection === "keyword-agent" ? "w-full flex-1 flex flex-col" : "hidden"}>
        <KeywordAgentPage />
      </div>
      <div className={activeSection === "sheets" ? "w-full flex-1 flex flex-col" : "hidden"}>
        {children}
      </div>
    </AppShell>
  );
};
