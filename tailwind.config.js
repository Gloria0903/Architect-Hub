/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vellum: "#ECEFEE",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#13191F",
          sidebar: "#0F1620",
        },
        muted: "#6B7680",
        blueprint: {
          DEFAULT: "#2451C4",
          bg: "#E7EDFA",
          50: "#E6F1FB",
          600: "#2451C4",
        },
        brick: {
          DEFAULT: "#B5502E",
          bg: "#F7E9E3",
        },
        moss: {
          DEFAULT: "#2F7A5E",
          bg: "#E6F0EA",
        },
        ochre: {
          DEFAULT: "#B07F1F",
          bg: "#F6EEDD",
        },
        line: "#DEE3E5",
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
