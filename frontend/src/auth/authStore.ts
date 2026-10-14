import { create } from "zustand";
import { API_BASE } from "../config";

export interface CurrentUser {
  id: string;
  username: string;
  display_name: string;
  role: "user" | "admin";
  access_expires_at?: string | null;
  days_left?: number | null;
}

interface AuthState {
  token: string | null;
  user: CurrentUser | null;
  deviceId: string;
  isLoading: boolean;
  errorNotice: { code: string; message: string } | null;
  isAdminMode: boolean;

  setToken: (token: string | null, user?: CurrentUser | null) => void;
  setUser: (user: CurrentUser | null) => void;
  setAdminMode: (admin: boolean) => void;
  setErrorNotice: (notice: { code: string; message: string } | null) => void;
  login: (username: string, password: string) => Promise<void>;
  loginUser: (username: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
  handleAuthError: (code: string, message: string) => void;
}

// Ensure persistent unique device ID per browser
const getOrCreateDeviceId = (): string => {
  const KEY = "fk_device_id";
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return "dev_node_env";
  }
  let did = localStorage.getItem(KEY);
  if (!did) {
    did =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "dev_" + Math.random().toString(36).substring(2);
    localStorage.setItem(KEY, did);
  }
  return did;
};

const getStoredToken = (): string | null => {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return null;
  }
  return sessionStorage.getItem("fk_auth_token") || (typeof localStorage !== "undefined" ? localStorage.getItem("fk_auth_token") : null);
};

const getStoredUser = (): CurrentUser | null => {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem("fk_auth_user") || (typeof localStorage !== "undefined" ? localStorage.getItem("fk_auth_user") : null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  deviceId: getOrCreateDeviceId(),
  isLoading: false,
  errorNotice: null,
  isAdminMode:
    typeof window !== "undefined"
      ? window.location.pathname.startsWith("/admin") || window.location.hash === "#admin"
      : false,

  setToken: (token, user = null) => {
    if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
      if (token) {
        sessionStorage.setItem("fk_auth_token", token);
        if (user) {
          sessionStorage.setItem("fk_auth_user", JSON.stringify(user));
        }
      } else {
        sessionStorage.removeItem("fk_auth_token");
        sessionStorage.removeItem("fk_auth_user");
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("fk_auth_token");
          localStorage.removeItem("fk_auth_user");
        }
      }
    }
    set({ token, user: user || get().user, errorNotice: null });
  },

  setUser: (user) => {
    if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
      if (user) {
        sessionStorage.setItem("fk_auth_user", JSON.stringify(user));
      } else {
        sessionStorage.removeItem("fk_auth_user");
      }
    }
    set({ user });
  },

  setAdminMode: (admin) => set({ isAdminMode: admin }),

  setErrorNotice: (errorNotice) => set({ errorNotice }),

  login: async (username: string, password: string) => {
    set({ isLoading: true, errorNotice: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          device_id: get().deviceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const code = data?.detail?.code || data?.error?.code || "INVALID_CREDENTIALS";
        const message = data?.detail?.message || data?.error?.message || "Invalid credentials. Please try again.";
        set({ isLoading: false, errorNotice: { code, message } });
        throw new Error(message);
      }

      const role: "user" | "admin" = data.role === "admin" ? "admin" : "user";
      const user: CurrentUser = {
        id: data.username,
        username: data.username,
        display_name: data.display_name || (role === "admin" ? "Administrator" : data.username),
        role,
        access_expires_at: data.access_expires_at,
        days_left: data.days_left,
      };

      get().setToken(data.token, user);
      set({ isLoading: false, errorNotice: null, isAdminMode: role === "admin" });
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  loginUser: async (username: string, password: string) => {
    return get().login(username, password);
  },

  loginAdmin: async (username: string, password: string) => {
    return get().login(username, password);
  },

  logout: async () => {
    const token = get().token;
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    get().setToken(null, null);
    set({ user: null, errorNotice: null });
  },

  checkSession: async () => {
    const token = get().token;
    if (!token) return false;

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const code = data?.error?.code || "SESSION_EXPIRED";
        const message = data?.error?.message || "Session has expired. Please log in again.";
        get().handleAuthError(code, message);
        return false;
      }

      const data = await res.json();
      const updatedUser: CurrentUser = {
        id: data.user_id,
        username: data.username,
        display_name: data.display_name,
        role: data.role,
        access_expires_at: data.access_expires_at,
        days_left: data.days_left,
      };
      get().setUser(updatedUser);
      return true;
    } catch {
      return true; // Keep local session on transient network disconnect
    }
  },

  handleAuthError: (code: string, message: string) => {
    get().setToken(null, null);
    set({
      user: null,
      errorNotice: { code, message },
    });
  },
}));
