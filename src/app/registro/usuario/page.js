// src/app/registro/usuario/page.js
import { Suspense } from "react";
import RegistroUsuarioClient from "./RegistroUsuarioClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto py-16 px-6">Cargando…</div>}>
      <RegistroUsuarioClient />
    </Suspense>
  );
}
