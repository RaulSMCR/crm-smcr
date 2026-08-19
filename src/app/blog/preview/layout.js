// Previsualización de borradores: contenido sin publicar, detrás de sesión.
// Nunca debe indexarse, ni siquiera si un enlace se filtra.
export const metadata = {
  title: "Vista previa",
  robots: { index: false, follow: false, nocache: true },
};

export default function BlogPreviewLayout({ children }) {
  return children;
}
