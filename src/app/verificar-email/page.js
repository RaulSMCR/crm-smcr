// src/app/verificar-email/page.js
import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

export default function VerifyEmailPage() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded border bg-white p-6">
            Verificando…
          </div>
        }
      >
        <div className="w-full max-w-md">
          <VerifyEmailClient />
        </div>
      </Suspense>
    </main>
  );
}
