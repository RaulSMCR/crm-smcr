import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { enviarSeguimiento } from "@/lib/reenganche";

// Recordatorio espaciado para alguien que faltó a una cita (D+3 y D+10).
//
// Lo dispara QStash, programado desde iniciarReenganche. La decisión de mandar o
// no vive en lib/reenganche, no acá: esta ruta solo valida la firma y traduce el
// resultado. Nunca devuelve 500 por una decisión de negocio, para que QStash no
// reintente algo que ya se resolvió.

async function handler(req) {
  try {
    const { patientId, appointmentId, intento } = await req.json();

    if (!patientId) {
      return NextResponse.json({ ok: false, reason: "Missing patientId" }, { status: 400 });
    }

    const resultado = await enviarSeguimiento({
      patientId,
      appointmentId: appointmentId || null,
      intento: Number(intento) || 1,
    });

    return NextResponse.json({
      ok: true,
      enviado: resultado.enviado,
      ...(resultado.motivo ? { omitido: resultado.motivo } : {}),
    });
  } catch (err) {
    console.error("Reenganche handler error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
