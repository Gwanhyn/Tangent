export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 24px 80px rgba(15, 23, 42, 0.16)',
        insetGlow: 'inset 0 1px 0 rgba(255, 255, 255, 0.56)',
      },
      animation: {
        rise: 'rise 420ms ease-out both',
        drift: 'drift 11s ease-in-out infinite alternate',
      },
      keyframes: {
        rise: {
          '0%': { opacity: 0, transform: 'translateY(14px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        drift: {
          '0%': { transform: 'translate3d(-1%, 0, 0) scale(1)' },
          '100%': { transform: 'translate3d(1%, -1%, 0) scale(1.03)' },
        },
      },
    },
  },
  plugins: [],
};

