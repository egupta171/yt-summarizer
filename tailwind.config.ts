import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
      ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        card: "#121821",
        ink: "#e5f0ff",
        subtle: "#9fb2cc",
        accent: "#7aa2ff"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;
