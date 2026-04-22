/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    '../blog/views/**/*.ejs',
    '../blog/src/**/*.js',
    '../server/viewmodels/**/*.js'
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '100%'
          }
        }
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
}
