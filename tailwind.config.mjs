// tailwind.config.mjs
/** @type {import('tailwindcss').Config} */
const neutralScale = {
  50: 'rgb(var(--neutral-50) / <alpha-value>)',
  100: 'rgb(var(--neutral-100) / <alpha-value>)',
  200: 'rgb(var(--neutral-200) / <alpha-value>)',
  300: 'rgb(var(--neutral-300) / <alpha-value>)',
  400: 'rgb(var(--neutral-400) / <alpha-value>)',
  500: 'rgb(var(--neutral-500) / <alpha-value>)',
  600: 'rgb(var(--neutral-600) / <alpha-value>)',
  700: 'rgb(var(--neutral-700) / <alpha-value>)',
  800: 'rgb(var(--neutral-800) / <alpha-value>)',
  900: 'rgb(var(--neutral-900) / <alpha-value>)',
  950: 'rgb(var(--neutral-950) / <alpha-value>)',
  DEFAULT: 'rgb(var(--neutral-900) / <alpha-value>)',
};

const brandScale = {
  50: 'rgb(var(--brand-50) / <alpha-value>)',
  100: 'rgb(var(--brand-100) / <alpha-value>)',
  200: 'rgb(var(--brand-200) / <alpha-value>)',
  300: 'rgb(var(--brand-300) / <alpha-value>)',
  400: 'rgb(var(--brand-400) / <alpha-value>)',
  500: 'rgb(var(--brand-500) / <alpha-value>)',
  600: 'rgb(var(--brand-600) / <alpha-value>)',
  700: 'rgb(var(--brand-700) / <alpha-value>)',
  800: 'rgb(var(--brand-800) / <alpha-value>)',
  900: 'rgb(var(--brand-900) / <alpha-value>)',
  950: 'rgb(var(--brand-950) / <alpha-value>)',
  DEFAULT: 'rgb(var(--brand-600) / <alpha-value>)',
};

const accentScale = {
  50: 'rgb(var(--accent-50) / <alpha-value>)',
  100: 'rgb(var(--accent-100) / <alpha-value>)',
  200: 'rgb(var(--accent-200) / <alpha-value>)',
  300: 'rgb(var(--accent-300) / <alpha-value>)',
  400: 'rgb(var(--accent-400) / <alpha-value>)',
  500: 'rgb(var(--accent-500) / <alpha-value>)',
  600: 'rgb(var(--accent-600) / <alpha-value>)',
  700: 'rgb(var(--accent-700) / <alpha-value>)',
  800: 'rgb(var(--accent-800) / <alpha-value>)',
  900: 'rgb(var(--accent-900) / <alpha-value>)',
  950: 'rgb(var(--accent-950) / <alpha-value>)',
  DEFAULT: 'rgb(var(--accent-600) / <alpha-value>)',
};

export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx,mdx}',
    './app/**/*.{js,jsx,ts,tsx,mdx}',
    './components/**/*.{js,jsx,ts,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // --- TUS COLORES (Sin cambios) ---
      colors: {
        brand: brandScale,
        accent: accentScale,
        neutral: neutralScale,

        // Alias de colores utilitarios de Tailwind para forzar toda la UI
        // a la paleta de marca (neutral / brand / accent).
        gray: neutralScale,
        slate: neutralScale,
        zinc: neutralScale,
        stone: neutralScale,

        blue: brandScale,
        indigo: brandScale,
        sky: brandScale,
        cyan: brandScale,
        teal: brandScale,
        emerald: brandScale,
        green: brandScale,

        amber: accentScale,
        yellow: accentScale,
        orange: accentScale,
        red: accentScale,
        rose: accentScale,
        pink: accentScale,
        fuchsia: accentScale,
        purple: accentScale,
        violet: accentScale,
        lime: accentScale,

        appbg: 'rgb(var(--app-bg) / <alpha-value>)',
        success: 'rgb(var(--success-600) / <alpha-value>)',
        warning: 'rgb(var(--warning-600) / <alpha-value>)',
        danger:  'rgb(var(--danger-600) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Inter',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
        ],
      },
      container: {
        center: true,
        padding: '1rem',
        screens: { '2xl': '1200px' },
      },
      borderRadius: {
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 8px 24px rgba(0,0,0,0.08)',
      },

      // --- NUEVA CONFIGURACIÓN DE TIPOGRAFÍA ---
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            // Elimina las comillas invertidas (backticks) en el código inline
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            // Estilo para código inline (opcional: fondo suave y texto destacado)
            code: {
              color: theme('colors.brand.600'),
              backgroundColor: theme('colors.neutral.100'),
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            // Aseguramos que los bloques de código (pre) respeten el tema oscuro del plugin
            'pre code': {
              backgroundColor: 'transparent', // El fondo lo pondrá el tema de highlight.js
              color: 'inherit',
              padding: '0',
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};
