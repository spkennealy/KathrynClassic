/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': {
          50: '#E8F5F1',   // Very light teal/mint
          100: '#C4E8DE',  // Light mint
          200: '#9FDCCB',  // Lighter teal
          300: '#7AD0B8',  // Light-medium teal
          400: '#55C3A5',  // Medium teal
          500: '#30B792',  // Base teal
          600: '#17856F',  // Dark teal (main brand color)
          700: '#136B5A',  // Darker teal
          800: '#0F5145',  // Very dark teal
          900: '#0B3730',  // Darkest teal
        },
        // Soft, slightly warm dark-mode surfaces (gentler than Tailwind's near-black gray-900).
        // Layering: 900 = page background, 800 = cards/nav, 700 = inputs/hover, 600 = borders.
        'night': {
          600: '#4e5867',  // borders / rings
          700: '#404a58',  // inputs / subtle hover
          800: '#343d4a',  // elevated surfaces (cards, nav, modals)
          900: '#2a313d',  // page background (soft slate, lighter than before)
        },
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'serif': ['Playfair Display', 'ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
      },
      keyframes: {
        highlight: {
          '0%': { backgroundColor: 'rgb(187, 247, 208)', transform: 'scale(1.05)' },
          '100%': { backgroundColor: 'transparent', transform: 'scale(1)' },
        }
      },
      animation: {
        highlight: 'highlight 1.5s ease-out',
      },
    },
  },
  plugins: [],
}