import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        "text-dim": "var(--text-dim)",
        sui: "var(--sui)",
        "sui-deep": "var(--sui-deep)",
        teal: "var(--teal)",
        pt: "var(--pt)",
        yt: "var(--yt)",
        pos: "var(--pos)",
        neg: "var(--neg)",
        warn: "var(--warn)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      borderRadius: {
        card: "16px",
        btn: "12px",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      transitionDuration: {
        DEFAULT: "180ms",
      },
    },
  },
  plugins: [],
};
export default config;
