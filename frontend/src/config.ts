/**
 * Global application configuration.
 *
 * In production when running on Vercel or any external host without a proxy,
 * API_BASE points to the live Render backend (https://sheetfill.onrender.com)
 * or can be overridden via VITE_API_URL.
 * In local dev (localhost), API_BASE defaults to empty string so Vite's proxy handles /api.
 */
export const API_BASE: string = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")
    ? "https://sheetfill.onrender.com"
    : "")
).replace(/\/$/, "");
