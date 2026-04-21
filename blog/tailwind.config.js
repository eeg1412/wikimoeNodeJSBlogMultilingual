import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/components/**/*.{vue,js}',
    './app/composables/**/*.{js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue'
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#f9f5f0',
          100: '#efe4d4',
          200: '#dfc59f',
          300: '#d19f61',
          400: '#c68338',
          500: '#b8692d',
          600: '#9c5228',
          700: '#7d4124',
          800: '#673621',
          900: '#582f1f'
        }
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Segoe UI"', 'sans-serif'],
        display: ['"Noto Serif SC"', 'serif']
      },
      boxShadow: {
        soft: '0 20px 60px rgba(42, 28, 16, 0.12)'
      }
    }
  },
  plugins: [typography]
}