/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          'primary': '#58BDAB',   // Teal Green
          'background': '#F5F3F0', // Light Cream
          'accent': '#F4A261',     // Soft Orange/Peach
          'dark': '#2D2D2D',      // Dark Gray for text
        }
      },
    },
  },
  plugins: [],
};

export default config;