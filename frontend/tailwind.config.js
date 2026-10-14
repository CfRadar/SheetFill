import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/react/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      borderRadius: {
        control: "10px",
        card: "14px",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        canvas: "var(--bg-background)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        "surface-subtle": "var(--surface-subtle)",
        "border-default": "var(--border)",
        "border-strong": "var(--border-strong)",
      },
    },
  },
  plugins: [
    heroui({
      layout: {
        radius: {
          small: "8px",
          medium: "10px",
          large: "14px",
        },
        borderWidth: {
          small: "1px",
          medium: "1.5px",
          large: "2px",
        },
      },
      themes: {
        light: {
          colors: {
            background: "#F6F7FB",
            foreground: "#151824",
            content1: "#FFFFFF",
            content2: "#FFFFFF",
            content3: "#F0F2F8",
            divider: "#E3E6EF",
            default: {
              50: "#FAFAFD",
              100: "#F0F2F8",
              200: "#E3E6EF",
              300: "#CDD2E0",
              400: "#8A91A5",
              500: "#5C6378",
              600: "#3E4456",
              700: "#2B3040",
              800: "#1D202D",
              900: "#151824",
              DEFAULT: "#E3E6EF",
              foreground: "#151824",
            },
            primary: {
              50: "#ECECFB",
              100: "#D8D9F7",
              200: "#B4B5F0",
              300: "#8E8FE7",
              400: "#7071DF",
              500: "#5B5BD6",
              600: "#4B4BC2",
              700: "#3C3CA8",
              800: "#2E2E88",
              900: "#212168",
              DEFAULT: "#5B5BD6",
              foreground: "#FFFFFF",
            },
            success: {
              50: "#E4F6EF",
              DEFAULT: "#1FA57A",
              foreground: "#FFFFFF",
            },
            warning: {
              50: "#FDF3DC",
              DEFAULT: "#E5A00D",
              foreground: "#FFFFFF",
            },
            danger: {
              50: "#FDECEC",
              DEFAULT: "#E5484D",
              foreground: "#FFFFFF",
            },
            focus: "#5B5BD6",
          },
        },
        dark: {
          // Warm minimalist dark aesthetic: warm charcoal canvas, warm slate surfaces, clean subtle borders
          colors: {
            background: "#121316",
            foreground: "#EEEEF2",
            content1: "#18191D",
            content2: "#202126",
            content3: "#25272D",
            divider: "#2E3037",
            default: {
              50: "#18191D",
              100: "#202126",
              200: "#2E3037",
              300: "#3E4049",
              400: "#7E818E",
              500: "#A6A8B4",
              600: "#C7C9D2",
              700: "#DFE0E6",
              800: "#EEEEF2",
              900: "#F8F8FA",
              DEFAULT: "#2E3037",
              foreground: "#EEEEF2",
            },
            primary: {
              50: "rgba(99, 102, 241, 0.16)",
              100: "#312E81",
              500: "#6366F1",
              600: "#4F46E5",
              DEFAULT: "#6366F1",
              foreground: "#FFFFFF",
            },
            success: {
              50: "rgba(34, 197, 94, 0.16)",
              DEFAULT: "#22C55E",
              foreground: "#FFFFFF",
            },
            warning: {
              50: "rgba(245, 158, 11, 0.16)",
              DEFAULT: "#F59E0B",
              foreground: "#FFFFFF",
            },
            danger: {
              50: "rgba(239, 68, 68, 0.16)",
              DEFAULT: "#EF4444",
              foreground: "#FFFFFF",
            },
            focus: "#6366F1",
          },
        },
      },
    }),
  ],
};
