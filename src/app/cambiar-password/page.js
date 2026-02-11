// PATH: src/app/cambiar-password/page.js
import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Cargando…</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
