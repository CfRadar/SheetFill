import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        flipkart: {
          blue: "#2874f0",
          yellow: "#ffe500",
          dark: "#172337",
          gray: "#878787",
          light: "#f1f3f6",
        },
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              DEFAULT: "#2563eb", // blue-600
              foreground: "#ffffff",
            },
            focus: "#2563eb",
          },
        },
        dark: {
          colors: {
            primary: {
              DEFAULT: "#3b82f6", // blue-500
              foreground: "#ffffff",
            },
            focus: "#3b82f6",
          },
        },
      },
    }),
  ],
};
