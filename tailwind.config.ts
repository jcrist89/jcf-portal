import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        jcf: {
          black: "#0a0a0a",
          charcoal: "#151515",
          panel: "#1c1c1c",
          gold: "#D9A125",
          goldLight: "#F0C05A",
          white: "#F5F5F5",
          gray: "#8A8A8A",
          danger: "#C1432E",
          success: "#3F8F5F",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        "diagonal-fade":
          "linear-gradient(135deg, rgba(217,161,37,0.15) 0%, rgba(10,10,10,0) 60%)",
      },
      clipPath: {
        angled: "polygon(0 0, 100% 0, 100% 85%, 0% 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
