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
        ink: "#17211f",
        mist: "#eef4f1",
        moss: "#42685a",
        clay: "#b76d4f",
        gold: "#e0ab45",
        fog: "#f7faf8",
        steel: "#7e8f89",
      },
      fontFamily: {
        body: ["var(--font-body)", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 31, 0.1)",
        panel: "0 24px 80px rgba(15, 27, 24, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
