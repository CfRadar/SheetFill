import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "sheetfill_theme_preference";

export const themeTokens = {
  radius: {
    sm: "rounded-md",
    md: "rounded-xl",
    lg: "rounded-2xl",
    full: "rounded-full",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  colors: {
    brandBlue: "#2563eb",
    brandYellow: "#ffe500",
  },
};

export function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  if (saved && (saved === "light" || saved === "dark" || saved === "system")) {
    return saved;
  }
  return "system";
}

export function applyThemeToDOM(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyThemeToDOM(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyThemeToDOM("system");
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
  };

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    if (theme === "system") {
      setTheme(isDark ? "light" : "dark");
    } else if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("system");
    }
  };

  return { theme, isDark, setTheme, toggleTheme };
}
