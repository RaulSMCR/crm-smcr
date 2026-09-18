"use client";

// El último recurso: una excepción en el propio layout raíz.
//
// `error.js` vive dentro del layout, así que no puede atrapar lo que rompa al
// layout mismo. Este sí, pero a cambio reemplaza todo el documento: por eso
// trae sus propios <html> y <body>, y no usa ni los estilos ni los componentes
// de la app —si el layout falló, asumir que algo de eso carga es apostar dos
// veces a lo mismo—.

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("[global-error]", { digest: error?.digest, message: error?.message });
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <main style={{ maxWidth: "36rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>La aplicación no pudo cargar</h1>
          <p style={{ color: "#475569", lineHeight: 1.6 }}>
            Es un problema nuestro. Si venías de agendar o de guardar algo, revisá tu panel antes de
            repetirlo: puede haber quedado registrado.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem", padding: "0.6rem 1rem", borderRadius: "0.75rem",
              border: "none", background: "#0f766e", color: "white", fontWeight: 600, cursor: "pointer",
            }}
          >
            Reintentar
          </button>
          {error?.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>
              Referencia: <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
