/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#0a0e17',
          card: 'rgba(15, 23, 42, 0.75)',
          border: 'rgba(56, 189, 248, 0.2)',
        },
        pulse: {
          cyan: '#00f3ff',
          magenta: '#ff007f',
          gold: '#ffd700',
          crimson: '#ff1a40',
          lime: '#39ff14',
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 25px rgba(0, 243, 255, 0.45)',
        'glow-gold': '0 0 25px rgba(255, 215, 0, 0.45)',
        'glow-crimson': '0 0 25px rgba(255, 26, 64, 0.5)',
        'glow-magenta': '0 0 25px rgba(255, 0, 127, 0.45)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      }
    },
  },
  plugins: [],
}
