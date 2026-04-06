/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f7f8fc',
          100: '#eef0f7',
          200: '#d9deeb',
          300: '#b4bdd9',
          400: '#8a94ba',
          500: '#6b7399',
          600: '#555b80',
          700: '#464a68',
          800: '#3d4058',
          900: '#1a1d2e',
          950: '#0f111a',
        },
        accent: {
          coral: '#ff6b6b',
          mint: '#4ecdc4',
          gold: '#f7c948',
          violet: '#a78bfa',
          sky: '#38bdf8',
        },
      },
      animation: {
        shimmer: 'shimmer 2.5s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
