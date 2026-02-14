/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // TAPT Brand Colors from logo
        'tapt-navy': '#1e3a5f',
        'tapt-blue': '#2570a4',
        'tapt-gold': '#8d6e25',
        'tapt-green': '#6b9f4d',
        'tapt-orange': '#f5a623',
        
        // Legacy color mapping (maps old colors to new brand colors)
        primary: {
          DEFAULT: '#2570a4',  // tapt-blue
          50: '#e8f0f8',
          100: '#d1e1f1',
          200: '#a3c3e3',
          300: '#75a5d5',
          400: '#4787c7',
          500: '#2570a4',
          600: '#226593',
          700: '#1a4c6e',
          800: '#11324a',
          900: '#091925',
        },
        secondary: {
          DEFAULT: '#1e3a5f',  // tapt-navy
          50: '#e8f0f8',
          100: '#d1e1f1',
          200: '#a3c3e3',
          300: '#75a5d5',
          400: '#4787c7',
          500: '#1e3a5f',
          600: '#172d4a',
          700: '#102036',
          800: '#0a1423',
          900: '#050a11',
        },
        accent: {
          DEFAULT: '#8d6e25',  // tapt-gold
          50: '#faf6ec',
          100: '#f5edd9',
          200: '#ebdbb3',
          300: '#e1c98d',
          400: '#d7b767',
          500: '#8d6e25',
          600: '#a6863b',
          700: '#7d642c',
          800: '#54431e',
          900: '#2b210f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        'inner-light': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      lineClamp: {
        7: '7',
        8: '8',
        9: '9',
        10: '10',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}