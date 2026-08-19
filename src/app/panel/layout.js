// src/app/panel/layout.js
// El panel comparte la dirección Nouveau con la cara pública: los títulos de
// pantalla usan la display serif igual que el resto de la plataforma. Lo que
// vuelve a la sans son las etiquetas de interfaz (versalitas con tracking),
// por la regla `h1/h2[class*="uppercase"]` de globals.css.
// El panel entero es área privada. Sin este export, las ~50 rutas de /panel/*
// heredaban los metadatos del layout raíz —incluido el canónico, que apuntaba a
// la home—, que es la instrucción más fuerte que existe para pedir que una
// página no se indexe por sí misma.
export const metadata = {
  title: { default: "Panel", template: "%s · Panel SMCR" },
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }) {
  return children;
}
