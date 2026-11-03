// src/app/api/pro/firmas/route.js
//
// GET  → las versiones de firma guardadas del profesional de la sesión.
// POST → guarda una firma nueva (PNG transparente, ya preparada en el
//        navegador a partir de una foto o de un trazo con el dedo).
//
// Las firmas se estampan en los formularios de seguro que se envían a los
// pacientes. Cada profesional maneja solo las suyas (ver requireFirmante).

import { NextResponse } from "next/server";
import { requireFirmante } from "@/lib/pro/firmante";
import { guardarFirma, LIMITE_DE_FIRMA, versionesDeFirma } from "@/lib/palig-storage";

export const dynamic = "force-dynamic";

function respuestaDeError(error, contexto) {
  // PaligError trae su status y un mensaje apto para mostrar.
  if (error?.status) return NextResponse.json({ message: error.message }, { status: error.status });
  console.error(`[pro/firmas] ${contexto}:`, error?.message);
  return NextResponse.json({ message: "No se pudo completar la acción." }, { status: 500 });
}

export async function GET() {
  const auth = await requireFirmante();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ versiones: await versionesDeFirma(auth.slug) });
  } catch (error) {
    return respuestaDeError(error, "GET");
  }
}

export async function POST(request) {
  const auth = await requireFirmante();
  if (auth.error) return auth.error;
  try {
    const form = await request.formData().catch(() => null);
    const archivo = form?.get("firma");
    if (!archivo || typeof archivo.arrayBuffer !== "function" || !archivo.size) {
      return NextResponse.json({ message: "Falta la imagen de la firma." }, { status: 400 });
    }
    if (archivo.size > LIMITE_DE_FIRMA) {
      return NextResponse.json({ message: "La firma no puede superar 1 MB." }, { status: 400 });
    }
    const version = await guardarFirma(auth.slug, Buffer.from(await archivo.arrayBuffer()));
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return respuestaDeError(error, "POST");
  }
}
