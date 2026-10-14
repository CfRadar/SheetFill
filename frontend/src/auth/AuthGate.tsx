import React, { useEffect } from "react";
import { useAuthStore } from "./authStore";
import { LoginPage } from "./LoginPage";
import { AdminDashboard } from "../admin/AdminDashboard";

interface Props {
  children: React.ReactNode;
}

export const AuthGate: React.FC<Props> = ({ children }) => {
  const { token, user, checkSession } = useAuthStore();

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

  // 1. Unauthenticated: render unified Login Page
  if (!token || !user) {
    return <LoginPage />;
  }

  // 2. Role-based routing: Admin goes directly to AdminDashboard
  if (user.role === "admin") {
    return <AdminDashboard />;
  }

  // 3. Subscribers (role="user") go directly to App
  return <>{children}</>;
};
