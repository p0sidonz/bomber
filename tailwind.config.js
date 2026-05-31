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
        'bm-dark': '#04040e',
        'bm-panel': '#080818',
        'bm-border': '#12122e',
        'bm-accent': '#00d4ff',
        'bm-red': '#ff2244',
        'bm-blue': '#2288ff',
        'bm-green': '#00e87a',
        'bm-yellow': '#ffcc00',
        'bm-purple': '#cc44ff',
        'bm-orange': '#ff7720',
        'bm-glow': 'rgba(0, 212, 255, 0.35)',
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
