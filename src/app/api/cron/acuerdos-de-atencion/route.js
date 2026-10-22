import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tareaDiariaDeAcuerdos } from "@/lib/acuerdos-de-atencion-server";

export const dynamic = "force-dynamic";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Tarea diaria de los acuerdos de atención (05:00 CR, ver vercel.json):
 * completa las citas de cada acuerdo activo hasta SEMANAS_GENERADAS hacia
 * adelante y programa los recordatorios de las sesiones de pasado mañana.
 *
 * Sin `maxDuration` propio a propósito: con la duración por defecto entra en el
 * bundle de las demás rutas de API y no suma uno nuevo al Functions Storage.
 */
export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const resultado = await tareaDiariaDeAcuerdos(prisma);
    if (resultado.omitidas.length) {
      console.warn("[cron/acuerdos-de-atencion] Sesiones omitidas por choque con otra cita:", resultado.omitidas);
    }
    return NextResponse.json({ ok: true, ...resultado, omitidas: resultado.omitidas.length });
  } catch (error) {
    console.error("[cron/acuerdos-de-atencion] Error:", error);
    return NextResponse.json({ error: "No se pudo completar la tarea de acuerdos." }, { status: 500 });
  }
}
