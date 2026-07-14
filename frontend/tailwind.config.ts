import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm cream surface + navy ink — Supervision Brain design system
        paper: {
          DEFAULT: "#f6f4ef",
          card: "#ffffff",
          sidebar: "#fbfaf7",
          subtle: "#f9f7f2",
        },
        ink: {
          DEFAULT: "#1a2233",
          navy: "#1c3452",
          "navy-dark": "#142943",
          "navy-deep": "#101d30",
        },
        line: {
          DEFAULT: "#e3ded2",
          soft: "#e9e4d8",
          faint: "#f1efe7",
          input: "#dcd7cc",
        },
        muted: {
          DEFAULT: "#7a7566",
          label: "#8a8470",
          faint: "#a39d8a",
          strong: "#524d40",
          body: "#4a463c",
        },
        risk: {
          critical: "#8c2b1f",
          "critical-bg": "#f6e4e1",
          "critical-border": "#e2b8ae",
          high: "#93551a",
          "high-bg": "#f7ead9",
          "high-border": "#e8cba4",
          "high-chart": "#c98a4a",
          medium: "#7d6423",
          "medium-bg": "#f4eed7",
          "medium-border": "#ddd0a0",
          "medium-chart": "#c7ad4e",
          low: "#3f6b4a",
          "low-bg": "#e6ece3",
          "low-border": "#c3d2bd",
        },
        accent: {
          tan: "#e7c9a3",
          slate: "#8c9db0",
          purple: "#6b4a72",
          "purple-bg": "#efe6f2",
          "purple-border": "#ddc7e0",
          info: "#1c3452",
          "info-bg": "#eef2f6",
          "info-border": "#d6e0e8",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
