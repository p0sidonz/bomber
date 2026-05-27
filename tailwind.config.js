/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
      },
      colors: {
        'bm-dark': '#0a0a0f',
        'bm-panel': '#12121e',
        'bm-border': '#2a2a4a',
        'bm-accent': '#f0c040',
        'bm-red': '#e03040',
        'bm-blue': '#3060e0',
        'bm-green': '#30c060',
        'bm-yellow': '#f0c040',
        'bm-purple': '#9040c0',
        'bm-orange': '#e08030',
        'bm-glow': '#f0c04080',
      },
      animation: {
        'pixel-blink': 'pixelBlink 0.8s step-end infinite',
        'float-up': 'floatUp 1s ease-out forwards',
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
        'spin-shrink': 'spinShrink 0.5s ease-in forwards',
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'countdown': 'countdownPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
      },
      keyframes: {
        pixelBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        floatUp: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-60px)', opacity: '0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px 2px #f0c04060' },
          '50%': { boxShadow: '0 0 20px 6px #f0c040aa' },
        },
        spinShrink: {
          '0%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'scale(0) rotate(360deg)', opacity: '0' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        countdownPop: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '60%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
