// src/app/verificar-email/page.js
import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded border bg-white p-6">
            Verificando…
          </div>
        </main>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
