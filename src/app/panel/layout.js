// src/app/panel/layout.js
// El panel comparte la dirección Nouveau con la cara pública: los títulos de
// pantalla usan la display serif igual que el resto de la plataforma. Lo que
// vuelve a la sans son las etiquetas de interfaz (versalitas con tracking),
// por la regla `h1/h2[class*="uppercase"]` de globals.css.
export default function PanelLayout({ children }) {
  return children;
}
