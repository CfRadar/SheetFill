/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
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
  plugins: [],
}
