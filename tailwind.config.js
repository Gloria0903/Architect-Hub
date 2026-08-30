/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Every color below reads from a CSS variable defined in
        // globals.css (light values under :root, dark overrides under
        // .dark) rather than a fixed hex value. The rgb(var(...) /
        // <alpha-value>) form is required, not just var(--x) directly,
        // to preserve Tailwind's opacity-modifier syntax (bg-brick/20,
        // border-line/[0.18], etc.) which is used throughout this app
        // -- a plain CSS var reference can't be sliced with /opacity.
        vellum: "rgb(var(--color-vellum) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          sidebar: "rgb(var(--color-ink-sidebar) / <alpha-value>)",
          solid: "rgb(var(--color-ink-solid) / <alpha-value>)",
        },
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        blueprint: {
          DEFAULT: "rgb(var(--color-blueprint) / <alpha-value>)",
          bg: "rgb(var(--color-blueprint-bg) / <alpha-value>)",
          50: "rgb(var(--color-blueprint-50) / <alpha-value>)",
          600: "rgb(var(--color-blueprint-600) / <alpha-value>)",
        },
        brick: {
          DEFAULT: "rgb(var(--color-brick) / <alpha-value>)",
          bg: "rgb(var(--color-brick-bg) / <alpha-value>)",
        },
        moss: {
          DEFAULT: "rgb(var(--color-moss) / <alpha-value>)",
          bg: "rgb(var(--color-moss-bg) / <alpha-value>)",
        },
        ochre: {
          DEFAULT: "rgb(var(--color-ochre) / <alpha-value>)",
          bg: "rgb(var(--color-ochre-bg) / <alpha-value>)",
        },
        line: "rgb(var(--color-line) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      borderRadius: {
        card: "9px",
      },
    },
  },
  plugins: [],
};
