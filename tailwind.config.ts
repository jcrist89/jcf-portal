import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        jcf: {
          black: "#07111C",
          charcoal: "#0B1724",
          panel: "#0F2031",
          gold: "#FF6B1A",\n          orange: "#FF6B1A",
          goldLight: "#FF8544",\n          orangeLight: "#FF8544",\n          blue: "#59A9DC",
          white: "#F4F7FB",
          gray: "#8FA5BE",
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
          "linear-gradient(135deg, rgba(255,107,26,0.13) 0%, rgba(7,17,28,0) 58%), radial-gradient(circle at 82% 18%, rgba(89,169,220,0.10), transparent 36%)",
      },
      clipPath: {
        angled: "polygon(0 0, 100% 0, 100% 85%, 0% 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
