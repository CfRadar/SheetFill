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
          colors: {
            background: "#0E1016",
            foreground: "#E9ECF4",
            content1: "#151821",
            content2: "#1B1F2A",
            content3: "#1F2430",
            divider: "#2A3040",
            default: {
              50: "#151821",
              100: "#1B1F2A",
              200: "#2A3040",
              300: "#3A4256",
              400: "#7A8197",
              500: "#A0A7BA",
              600: "#C2C8D6",
              700: "#DCE0EB",
              800: "#E9ECF4",
              900: "#F4F6FB",
              DEFAULT: "#2A3040",
              foreground: "#E9ECF4",
            },
            primary: {
              50: "rgba(91, 91, 214, 0.18)",
              100: "#2E2E88",
              500: "#5B5BD6",
              600: "#4B4BC2",
              DEFAULT: "#5B5BD6",
              foreground: "#FFFFFF",
            },
            success: {
              50: "rgba(31, 165, 122, 0.16)",
              DEFAULT: "#1FA57A",
              foreground: "#FFFFFF",
            },
            warning: {
              50: "rgba(229, 160, 13, 0.16)",
              DEFAULT: "#E5A00D",
              foreground: "#FFFFFF",
            },
            danger: {
              50: "rgba(229, 72, 77, 0.16)",
              DEFAULT: "#E5484D",
              foreground: "#FFFFFF",
            },
            focus: "#5B5BD6",
          },
        },
      },
    }),
  ],
};
