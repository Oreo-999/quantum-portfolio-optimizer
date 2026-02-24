/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#080808",
        surface: "#101010",
        card: "#141414",
        border: "#1e1e1e",
        "border-soft": "#2a2a2a",
        muted: "#3a3a3a",
        subtle: "#6b6b6b",
        secondary: "#a0a0a0",
        primary: "#e8e8e8",
        white: "#ffffff",
        blue: {
          DEFAULT: "#3b82f6",
          dim: "rgba(59,130,246,0.1)",
          border: "rgba(59,130,246,0.25)",
        },
        qaoa: "#60a5fa",
        classical: "#737373",
        positive: "#4ade80",
        negative: "#f87171",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      animation: {
        "spin-slow": "spin 2s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
