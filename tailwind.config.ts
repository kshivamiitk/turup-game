import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./socket/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          950: "#071814",
          900: "#0b211d",
          800: "#12332c",
          700: "#17473d"
        },
        brass: "#d5aa4e",
        ember: "#d84b4b",
        ink: "#07100f"
      },
      boxShadow: {
        table: "0 24px 80px rgba(0, 0, 0, 0.42)",
        card: "0 14px 38px rgba(0, 0, 0, 0.26)"
      }
    }
  },
  plugins: []
};

export default config;
