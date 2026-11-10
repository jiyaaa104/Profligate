/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070A10",
          900: "#0B0F17", // Primary Deep Navy Background
          850: "#101623", // Card / Panel Background
          800: "#151D2E", // Elevated Surfaces
          700: "#1E293B", // Borders / Dividers
          600: "#334155",
        },
        brand: {
          emerald: "#10B981", // Emerald accent
          "emerald-hover": "#059669",
          "emerald-light": "#34D399",
          amber: "#F59E0B",
          red: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        glass: "0 0 40px rgba(16, 185, 129, 0.08)",
        "glass-sm": "0 4px 20px rgba(0, 0, 0, 0.4)",
        glow: "0 0 25px rgba(16, 185, 129, 0.25)",
      },
    },
  },
  plugins: [],
};

