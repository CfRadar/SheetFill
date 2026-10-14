import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./authStore";

// Mock localStorage and sessionStorage for test runner
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

if (typeof window === "undefined") {
  (globalThis as any).window = {
    location: { pathname: "/", hash: "", origin: "http://localhost:3000" },
  };
}
(globalThis as any).sessionStorage = createMockStorage();
(globalThis as any).localStorage = createMockStorage();

describe("authStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    useAuthStore.getState().setToken(null, null);
  });

  it("initializes and handles null state", () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.deviceId).toBeTruthy();
  });

  it("sets and clears tokens in storage correctly", () => {
    useAuthStore.getState().setToken("mock_jwt_token", {
      id: "u1",
      username: "testuser",
      display_name: "Test User",
      role: "user",
    });

    expect(useAuthStore.getState().token).toBe("mock_jwt_token");
    expect(useAuthStore.getState().user?.username).toBe("testuser");
    expect(sessionStorage.getItem("fk_auth_token")).toBe("mock_jwt_token");

    useAuthStore.getState().setToken(null, null);
    expect(useAuthStore.getState().token).toBeNull();
    expect(sessionStorage.getItem("fk_auth_token")).toBeNull();
  });

  it("handles auth error by clearing token and setting notice", () => {
    useAuthStore.getState().setToken("mock_jwt_token");
    useAuthStore.getState().handleAuthError("SESSION_REPLACED", "Active on another device.");

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.errorNotice?.code).toBe("SESSION_REPLACED");
    expect(state.errorNotice?.message).toBe("Active on another device.");
  });
});
