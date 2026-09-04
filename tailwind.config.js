/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        studio: {
          bg: '#F7F1EA',
          ink: '#3D3A4A',
          sky: '#B8DFF0',
          sun: '#F8D9A8',
          berry: '#F5C4D1',
          mint: '#C8EBD8',
          grape: '#D5C7F5',
        },
      },
      boxShadow: {
        paper: '0 12px 40px -12px rgba(30, 41, 59, 0.18)',
        pop: '0 8px 0 0 rgba(30, 41, 59, 0.12)',
      },
    },
  },
  plugins: [],
}
