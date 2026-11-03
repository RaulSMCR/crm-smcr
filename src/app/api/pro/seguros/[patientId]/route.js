// src/app/api/pro/seguros/[patientId]/route.js
//
// La parte del profesional en el formulario PALIG de un paciente suyo:
//   GET              etapa del formulario y lo que ya escribió
//   GET ?pdf=paciente|plantilla|muestra  el PDF, para revisarlo
//   POST { datos }   completa su parte: se arma y se guarda la plantilla
//
// Solo para pacientes del profesional de la sesión (por citas o por caso).
// La lógica vive en src/lib/palig-plantillas.js.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { esPacienteDelProfesional } from "@/lib/casos";
import {
  descargarDelPaciente,
  estadoParaElProfesional,
  guardarParteDelProfesional,
} from "@/lib/palig-plantillas";
import { muestraFechaPalig } from "@/lib/palig-pdf";

export const dynamic = "force-dynamic";

async function contexto(params, { escribe = false } = {}) {
  const deny = (status, message) => ({ error: NextResponse.json({ message }, { status }) });
  const session = await getSession();
  if (!session || session.role !== "PROFESSIONAL") return deny(401, "Sesión requerida.");
  if (escribe && isPreviewSession(session)) return deny(403, PREVIEW_BLOCKED_MESSAGE);

  const userId = String(session.sub || session.userId || "");
  const perfil = userId
    ? await prisma.professionalProfile.findUnique({ where: { userId }, select: { id: true, isApproved: true } })
    : null;
  if (!perfil?.isApproved) return deny(403, "El perfil profesional no está aprobado.");

  const { patientId } = await params; // Next 16: params es una promesa.
  if (!(await esPacienteDelProfesional(patientId, perfil.id))) return deny(404, "Paciente no encontrado.");
  return { professionalId: perfil.id, patientId: String(patientId) };
}

function respuestaDeError(error) {
  if (error?.status) return NextResponse.json({ message: error.message }, { status: error.status });
  console.error("[pro/seguros] error:", error?.name || "error");
  return NextResponse.json({ message: "No se pudo completar. Intente de nuevo." }, { status: 500 });
}

const pdf = (bytes, nombre) =>
  new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });

export async function GET(request, { params }) {
  const ctx = await contexto(params);
  if (ctx.error) return ctx.error;
  try {
    const cual = new URL(request.url).searchParams.get("pdf");
    if (!cual) {
      const estado = await estadoParaElProfesional(prisma, ctx.patientId);
      return NextResponse.json({ ...estado, plantillaDeOtro: Boolean(estado.plantillaProId && estado.plantillaProId !== ctx.professionalId) });
    }

    const paciente = await prisma.user.findUnique({
      where: { id: ctx.patientId },
      select: { insurancePatientFormUrl: true, insuranceTemplateUrl: true },
    });
    if (cual === "paciente" && paciente?.insurancePatientFormUrl) {
      return pdf(await descargarDelPaciente(paciente.insurancePatientFormUrl, ctx.patientId, "insurance-patient-forms"), "PALIG-parte-del-paciente.pdf");
    }
    if ((cual === "plantilla" || cual === "muestra") && paciente?.insuranceTemplateUrl) {
      const plantilla = await descargarDelPaciente(paciente.insuranceTemplateUrl, ctx.patientId, "insurance-templates");
      // La muestra lleva una fecha de ejemplo: así se ve cómo saldrá en cada pago.
      return pdf(cual === "muestra" ? await muestraFechaPalig(plantilla) : plantilla, "PALIG-plantilla.pdf");
    }
    return NextResponse.json({ message: "Ese documento todavía no existe." }, { status: 404 });
  } catch (error) {
    return respuestaDeError(error);
  }
}

export async function POST(request, { params }) {
  const ctx = await contexto(params, { escribe: true });
  if (ctx.error) return ctx.error;
  try {
    const body = await request.json().catch(() => ({}));
    await guardarParteDelProfesional(prisma, {
      patientId: ctx.patientId,
      professionalId: ctx.professionalId,
      datos: body?.datos || {},
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return respuestaDeError(error);
  }
}
