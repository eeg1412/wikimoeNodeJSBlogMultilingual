module.exports = {
  darkMode: 'class',
  content: [
    './views/**/*.ejs',
    './src/**/*.js',
    '../server/viewmodels/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#fff8eb',
          100: '#ffefc8',
          200: '#ffdd88',
          300: '#ffc24f',
          400: '#f6a51f',
          500: '#df860f',
          600: '#c2670d',
          700: '#9b4a11',
          800: '#7d3c15',
          900: '#683315'
        }
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'Segoe UI', 'sans-serif'],
        serif: ['Noto Serif SC', 'Georgia', 'serif']
      },
      boxShadow: {
        panel: '0 22px 60px rgba(15, 23, 42, 0.16)'
      }
    }
  },
  plugins: []
}
