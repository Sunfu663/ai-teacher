/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 墨蓝 - 主色,沉稳学术感
        ink: {
          DEFAULT: "#1E2A5E",
          50: "#EEF1FA",
          100: "#D6DCEF",
          200: "#ADB9DD",
          300: "#7E8FC4",
          400: "#5569A8",
          500: "#3A4D87",
          600: "#2C3C6F",
          700: "#1E2A5E",
          800: "#162044",
          900: "#0E1630",
        },
        // 批注红 - 教师红笔,错误标注
        pen: {
          DEFAULT: "#E63946",
          50: "#FDECEE",
          100: "#FBD5D9",
          200: "#F6ABB3",
          300: "#F0808C",
          400: "#EA5666",
          500: "#E63946",
          600: "#C92835",
          700: "#A21F2A",
          800: "#7B171F",
          900: "#530F14",
        },
        // 鼓励绿 - 正确反馈,掌握度良好
        sage: {
          DEFAULT: "#2A9D8F",
          50: "#E8F5F3",
          100: "#C9E9E4",
          200: "#94D3CB",
          300: "#5FBCB2",
          400: "#3AA89E",
          500: "#2A9D8F",
          600: "#1F8074",
          700: "#176359",
          800: "#0F4640",
          900: "#082925",
        },
        // 纸本 - 温暖米白背景
        paper: {
          DEFAULT: "#FAF7F0",
          50: "#FEFDFB",
          100: "#FAF7F0",
          200: "#F2EDE0",
          300: "#E8E0CD",
          400: "#D9CCAE",
        },
        // 琥珀 - 提示,标签辅助色
        amber: {
          DEFAULT: "#E9A23B",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        card: "0 2px 12px rgba(30, 42, 94, 0.06)",
        cardHover: "0 6px 20px rgba(30, 42, 94, 0.12)",
        pen: "0 2px 8px rgba(230, 57, 70, 0.15)",
      },
      borderRadius: {
        pill: "9999px",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        drawIn: {
          "0%": { opacity: "0", transform: "scaleX(0)" },
          "100%": { opacity: "1", transform: "scaleX(1)" },
        },
        stamp: {
          "0%": { opacity: "0", transform: "scale(1.6) rotate(-12deg)" },
          "60%": { opacity: "1", transform: "scale(0.9) rotate(-12deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(-12deg)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        fadeInUp: "fadeInUp 0.5s ease-out forwards",
        drawIn: "drawIn 0.4s ease-out forwards",
        stamp: "stamp 0.4s ease-out forwards",
        pulseSoft: "pulseSoft 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
