import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101c2d",
        muted: "#5b6170",
        panel: "#ffffff",
        field: "#f7f9ff",
        line: "#cbd4e5",
        brand: "#003d9b",
        "brand-soft": "#dae5ff",
        "brand-mid": "#b9ccff",
        success: "#0f7b55",
        warning: "#9a5a00",
        danger: "#ba1a1a"
      },
      boxShadow: {
        soft: "0 8px 28px rgba(16, 28, 45, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
