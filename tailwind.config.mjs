// tailwind.config.mjs

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
        // --- NUEVA PALETA DE COLORES BASADA EN TU LOGO ---
        'brand': {
          'primary': '#2F5F68',      // Verde oscuro/azulado (Monstera)
          'secondary': '#F08080',   // Coral/Salmón (Punto de acento)
          'background': '#EAF0EB',   // Fondo claro/menta
          'text': '#3A3A3A',         // Gris oscuro para texto
          'light-gray': '#F5F5F5',  // Gris muy claro para fondos sutiles
        }
      },
    },
  },
  plugins: [],
};

export default config; // Asegurándonos de usar la sintaxis correcta para .mjs