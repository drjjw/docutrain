/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'docutrain': {
          'dark': '#003399',
          'medium': '#0066CC',
          'light': '#3399FF',
          'lighter': '#66CCFF',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

