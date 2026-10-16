/** @type {import('tailwindcss').Config} */
import formsPlugin from "@tailwindcss/forms"

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    // Keep the existing admin CSS intact — Tailwind's base reset
    // is not applied to the rest of the app.
    preflight: false,
  },
  theme: {
    transparent: "transparent",
    current: "currentColor",
    extend: {
      colors: {
        // shadcn/ui design tokens mapped onto the existing admin theme
        background: "var(--white)",
        foreground: "var(--text)",
        card: {
          DEFAULT: "var(--bg-card)",
          foreground: "var(--text)",
        },
        popover: {
          DEFAULT: "var(--white)",
          foreground: "var(--text)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "#ffffff",
          dark: "var(--primary-dark)",
          50: "var(--primary-50)",
          100: "var(--primary-100)",
          200: "var(--primary-200)",
        },
        secondary: {
          DEFAULT: "var(--bg)",
          foreground: "var(--text)",
        },
        muted: {
          DEFAULT: "var(--bg)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--primary-100)",
          foreground: "var(--primary-dark)",
        },
        destructive: {
          DEFAULT: "var(--error)",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "#ffffff",
        },
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--primary)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
    },
  },
  plugins: [formsPlugin],
}
