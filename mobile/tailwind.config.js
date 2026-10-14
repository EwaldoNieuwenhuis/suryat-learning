/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        limestone: {
          DEFAULT: "#F6F0E6",
          parchment: "#EFE6D5",
          border: "#DFD3BD",
        },
        basalt: {
          DEFAULT: "#161412",
          surface: "#221F1B",
          border: "#36312B",
        },
        manuscript: {
          DEFAULT: "#8C1D24",
          dark: "#681319",
          light: "#B22B34",
        },
        suryoyeGold: {
          DEFAULT: "#D4AF37",
          saffron: "#E09F3E",
          muted: "#B38F24",
        },
        terracotta: "#A85A3A",
        oliveTurAbdin: "#4A5D4E",
      },
      fontFamily: {
        sans: ["NotoSans-Regular"],
        "sans-bold": ["NotoSans-Bold"],
        serto: ["NotoSansSyriacWestern-Regular"],
        "serto-bold": ["NotoSansSyriacWestern-Bold"],
      },
    },
  },
  plugins: [],
};
