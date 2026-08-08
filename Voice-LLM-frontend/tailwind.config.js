/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16151A',
        surface: '#1E1D24',
        surfaceLight: '#28262F',
        mist: '#F5F3EF',
        muted: '#9A97A6',
        cyan: {
          DEFAULT: '#5EEAD4',
        },
        amber: {
          DEFAULT: '#F0A868',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
