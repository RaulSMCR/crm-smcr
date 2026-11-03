// src/app/api/mi/seguro-palig/route.js
//
// El paciente entrega su parte del formulario de reclamo de PALIG, una sola vez:
//   POST modo=enLinea  datos (JSON) + firma (PNG hecho con el dedo)
//   POST modo=archivo  archivo (PDF, JPG o PNG del papel firmado)
// GET devuelve en qué etapa está y lo que ya había llenado.
//
// El middleware exige sesión de paciente (USER) en /api/mi. La lógica vive en
// src/lib/palig-plantillas.js.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE, sessionUserId } from "@/lib/auth";
import { estadoParaElPaciente, guardarParteDelPaciente, profesionalesDelPaciente } from "@/lib/palig-plantillas";
import { sendPaligParteProfesionalPendiente } from "@/lib/insurance-mail";

export const dynamic = "force-dynamic";

async function paciente() {
  const session = await getSession();
  if (!session || session.role !== "USER") return { error: NextResponse.json({ message: "Sesión requerida." }, { status: 401 }) };
  return { session, userId: sessionUserId(session) };
}

function respuestaDeError(error) {
  if (error?.status) return NextResponse.json({ message: error.message }, { status: error.status });
  console.error("[mi/seguro-palig] error:", error?.name || "error");
  return NextResponse.json({ message: "No se pudo completar. Intente de nuevo." }, { status: 500 });
}

export async function GET() {
  const ctx = await paciente();
  if (ctx.error) return ctx.error;
  try {
    return NextResponse.json(await estadoParaElPaciente(prisma, ctx.userId));
  } catch (error) {
    return respuestaDeError(error);
  }
}

export async function POST(request) {
  const ctx = await paciente();
  if (ctx.error) return ctx.error;
  if (isPreviewSession(ctx.session)) return NextResponse.json({ message: PREVIEW_BLOCKED_MESSAGE }, { status: 403 });

  try {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ message: "No llegó el formulario." }, { status: 400 });
    let datos = {};
    try {
      datos = JSON.parse(String(form.get("datos") || "{}"));
    } catch {
      return NextResponse.json({ message: "Los datos llegaron incompletos." }, { status: 400 });
    }

    const resultado = await guardarParteDelPaciente(prisma, ctx.userId, {
      modo: String(form.get("modo") || ""),
      datos,
      firma: form.get("firma"),
      archivo: form.get("archivo"),
    });

    // Si la plantilla se rearmó sola, el profesional no tiene nada que hacer.
    if (!resultado.plantillaRearmada) {
      const profesionales = await profesionalesDelPaciente(prisma, ctx.userId);
      await Promise.allSettled(
        profesionales.map((p) =>
          sendPaligParteProfesionalPendiente({
            proEmail: p.user?.email,
            patientName: resultado.paciente.name || "Su paciente",
            patientId: ctx.userId,
          })
        )
      );
    }

    return NextResponse.json({ etapa: resultado.etapa, plantillaRearmada: resultado.plantillaRearmada }, { status: 201 });
  } catch (error) {
    return respuestaDeError(error);
  }
}
