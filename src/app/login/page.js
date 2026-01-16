// src/app/login/page.js
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="rounded border bg-white/50 p-4 text-center">
              Cargando…
            </div>
          </div>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
