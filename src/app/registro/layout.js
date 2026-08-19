// Las tres páginas de /registro son "use client" y por lo tanto no pueden
// exportar `metadata`. Este layout server-side lo hace por ellas.
//
// Antes heredaban del layout raíz, que declaraba el canónico del sitio: las tres
// le decían a Google «la versión buena de esta página es la home». Y el sitemap
// las publicaba. Ahora declaran noindex y salieron del sitemap; el robots.txt
// deliberadamente NO las bloquea, para que el crawler pueda llegar a leer el
// noindex y sacarlas del índice donde ya están.
export const metadata = {
  title: { default: "Registro", template: "%s · Salud Mental Costa Rica" },
  robots: { index: false, follow: false },
};

export default function RegistroLayout({ children }) {
  return children;
}
