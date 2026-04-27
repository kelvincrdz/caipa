/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design System principal - Dark/Amber
        primary: '#FFB800',  // Amber principal
        secondary: '#0A0A0A', // Preto principal
        surface: {
          dark: '#1A1A1A',    // Cinza escuro para cards
          darker: '#2A2A2A',  // Hover states
        },
        accent: {
          amber: '#FFB800',   // Amber
          green: '#39FF14',   // Party mode
        },
        text: {
          muted: '#807A6D',   // Texto secundário
        },
        // Alias para compatibilidade
        'surface-dark': '#1A1A1A',
        'surface-darker': '#2A2A2A',
        'text-muted': '#807A6D',
      },
      fontFamily: {
        'display': ['Calistoga', 'serif'],           // 96px Hero titles
        'body': ['Space Grotesk', 'sans-serif'],     // 48px stats, navegação
        'label': ['IBM Plex Sans', 'sans-serif'],    // 14px labels
      },
      fontSize: {
        'hero-desktop': '96px',
        'hero-mobile': '48px',
        'stats': '48px',
        'label': '14px',
      },
      borderRadius: {
        'asymmetric': '12px 4px',
      },
      boxShadow: {
        'hard': '8px 8px 0 0 rgba(0, 0, 0, 1)',
        'surface': '4px 4px 12px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'vinyl-spin': 'spin 10s linear infinite',
        'marquee': 'marquee 40s linear infinite',
        'bounce-soft': 'bounce-soft 0.3s ease-out',
        'pulse-amber': 'pulse-amber 2s infinite',
        'count-up': 'count-up 0.8s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-out-left': 'slide-out-left 0.3s ease-in',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
        },
        'pulse-amber': {
          '0%, 100%': {
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(255, 184, 0, 0.7)'
          },
          '50%': {
            transform: 'scale(1.1)',
            boxShadow: '0 0 0 8px rgba(255, 184, 0, 0)'
          },
        },
        'count-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          },
        },
        'slide-in-right': {
          '0%': {
            opacity: '0',
            transform: 'translateX(100%)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)'
          },
        },
        'slide-out-left': {
          '0%': {
            opacity: '1',
            transform: 'translateX(0)'
          },
          '100%': {
            opacity: '0',
            transform: 'translateX(-100%)'
          },
        },
      },
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
    },
  },
  plugins: [],
}