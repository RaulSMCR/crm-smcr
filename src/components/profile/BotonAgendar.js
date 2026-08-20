"use client";

// El botón "Agendar cita" del perfil profesional.
//
// Existe como componente cliente por una sola razón: leía `?serviceId=` desde el
// servidor, y eso volvía dinámica toda la página. Los perfiles son las fichas
// donde vive la credencial verificada —las que más conviene que sean rápidas y
// que un crawler reciba enteras—, así que el resto de la página se prerenderiza
// y solo este enlace se ajusta en el navegador.
//
// La preselección no se perdió: quien llega desde /servicios/musicoterapia
// sigue viendo el botón apuntando a ese servicio. Lo que cambia es cuándo se
// resuelve, no si se resuelve.

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function Boton({ professionalId, services }) {
  const searchParams = useSearchParams();
  const pedido = searchParams.get("serviceId");
  const elegido = services.find((s) => s.id === pedido) || services[0];

  return (
    <Link href={`/agendar/${professionalId}?serviceId=${elegido.id}`} className="btn btn-accent mt-6 w-full">
      Agendar cita
    </Link>
  );
}

export default function BotonAgendar({ professionalId, services }) {
  if (!services?.length) return null;

  return (
    // El fallback es el mismo botón con el primer servicio: es lo que se
    // prerenderiza y lo que ve quien no ejecuta JavaScript. Un enlace válido,
    // no un hueco.
    <Suspense
      fallback={
        <Link
          href={`/agendar/${professionalId}?serviceId=${services[0].id}`}
          className="btn btn-accent mt-6 w-full"
        >
          Agendar cita
        </Link>
      }
    >
      <Boton professionalId={professionalId} services={services} />
    </Suspense>
  );
}
