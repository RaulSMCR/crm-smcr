import { Suspense } from "react";
import { resolverIntencionDeAgenda } from "@/lib/intencion-de-agenda-servidor";

export const metadata = {
  title: "Ingresar",
  robots: { index: false, follow: false },
};
import LoginClient from "./LoginClient";

export default async function LoginPage({ searchParams }) {
  const resueltos = await searchParams;
  const next = typeof resueltos?.next === "string" ? resueltos.next : "";
  // Para quien viene de una agenda, esta pantalla no es un destino sino un
  // peaje: hay que decirle qué cita lo está esperando del otro lado, y con los
  // datos de la base, no con los del enlace.
  const intencion = await resolverIntencionDeAgenda(next);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-5rem)] w-full items-center justify-center bg-neutral-950">
          <span className="text-sm text-neutral-400">Cargando…</span>
        </div>
      }
    >
      <LoginClient intencion={intencion} />
    </Suspense>
  );
}
