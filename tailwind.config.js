/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#080d14',
        surface: '#0f1824',
        card: '#131f2e',
        'card-hover': '#1a2a3d',
        'pelér': '#4d8fff',
        'peler': '#4d8fff',
        ora: '#f5a623',
        good: '#00d4aa',
        danger: '#ff4d6d',
        neutral: '#4a5a70',
        marginal: '#0ea5e9',
        advanced: '#f59e0b',
        storm: '#ef4444',
        'text-primary': '#e2eaff',
        'text-secondary': '#6b7f97',
        'text-muted': '#3d5068',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
      },
      backdropBlur: {
        sm: '8px',
      },
      animation: {
        'pulse-dot': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease forwards',
        'glow': 'glow 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 212, 170, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(0, 212, 170, 0.7)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
