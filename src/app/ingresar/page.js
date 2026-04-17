import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-4rem)] w-full items-center justify-center bg-neutral-950">
          <span className="text-sm text-neutral-400">Cargando…</span>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
