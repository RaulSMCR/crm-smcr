// PATH: src/app/cambiar-password/page.js
import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata = {
  title: "Cambiar contraseña",
  // Se llega por enlace con token, nunca por búsqueda.
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Cargando…</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
