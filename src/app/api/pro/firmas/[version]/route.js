// src/app/api/pro/firmas/[version]/route.js
//
// GET    → la imagen de una firma del profesional de la sesión, para verla en
//          su pantalla de firmas. Nunca la de otro: la carpeta sale de su slug.
// DELETE → la borra. Un formulario ya firmado con esa versión no cambia: el PDF
//          firmado se guardó aparte.

import { NextResponse } from "next/server";
import { requireFirmante } from "@/lib/pro/firmante";
import { borrarFirma, descargarFirma } from "@/lib/palig-storage";

export const dynamic = "force-dynamic";

async function versionDe(params) {
  const { version } = await params; // Next 16: params es una promesa.
  const numero = Number(version);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export async function GET(_request, { params }) {
  const auth = await requireFirmante();
  if (auth.error) return auth.error;
  const version = await versionDe(params);
  if (!version) return NextResponse.json({ message: "Versión inválida." }, { status: 400 });
  try {
    const bytes = await descargarFirma(auth.slug, version);
    return new Response(bytes, {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ message: "Firma no encontrada." }, { status: 404 });
  }
}

export async function DELETE(_request, { params }) {
  const auth = await requireFirmante();
  if (auth.error) return auth.error;
  const version = await versionDe(params);
  if (!version) return NextResponse.json({ message: "Versión inválida." }, { status: 400 });
  try {
    await borrarFirma(auth.slug, version);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "No se pudo borrar la firma." }, { status: error?.status || 500 });
  }
}
