// src/app/panel/layout.js
// Único propósito: marcar el panel como UI funcional (`nv-ui`) para que los
// títulos NO usen la display serif. La dirección Nouveau es para la cara
// pública; acá los h1/h2 son etiquetas de interfaz.
export default function PanelLayout({ children }) {
  return <div className="nv-ui">{children}</div>;
}
