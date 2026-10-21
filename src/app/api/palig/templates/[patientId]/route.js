import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePaligOperator } from "@/lib/palig-auth";
import { PALIG_PROFESSIONAL_SLUG, esPalig } from "@/lib/palig-policy";
import { completarPalig, validarPlantillaPalig, PaligError } from "@/lib/palig-pdf";
import { leerArchivoPalig, guardarPalig } from "@/lib/palig-storage";

async function context(patientId) {
  const auth = await requirePaligOperator();
  if (auth.error) return auth;
  const professional = await prisma.professionalProfile.findUnique({ where: { slug: PALIG_PROFESSIONAL_SLUG }, select: {
    id: true, specialty: true, licenseNumber: true, user: { select: { name: true, phone: true } },
  } });
  const patient = professional && await prisma.user.findFirst({ where: {
    id: patientId, appointments: { some: { professionalId: professional.id } },
  }, select: { id: true, name: true, birthDate: true, insuranceName: true } });
  if (!patient || !esPalig(patient.insuranceName)) return { error: NextResponse.json({ message: "Paciente no disponible para PALIG." }, { status: 404 }) };
  return { auth, patient, professional };
}

export async function GET(_request, { params }) {
  const ctx = await context((await params).patientId);
  if (ctx.error) return ctx.error;
  try {
    const source = await readFile(path.join(process.cwd(), "public/forms/palig-cr-reclamo-2023.pdf"));
    const bytes = await completarPalig(source, ctx);
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="PALIG-plantilla-editable.pdf"', "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "No se pudo preparar la plantilla editable." }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const ctx = await context((await params).patientId);
  if (ctx.error) return ctx.error;
  try {
    const fd = await request.formData();
    if (fd.get("preparadaPorRaul") !== "true") throw new PaligError("Confirme que Raúl completó y revisó la plantilla sin firmas ni fechas de atención.");
    const { bytes } = await leerArchivoPalig(fd.get("file"));
    const checked = await validarPlantillaPalig(bytes);
    const prepared = await completarPalig(checked, ctx);
    const reference = await guardarPalig("insurance-templates", `${ctx.patient.id}/palig-${randomUUID()}.pdf`, prepared);
    await prisma.user.update({ where: { id: ctx.patient.id }, data: {
      insuranceTemplateUrl: reference, insuranceTemplateUploadedAt: new Date(), insuranceTemplateProId: ctx.professional.id,
    } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PaligError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("[palig] TEMPLATE_SAVE_FAILED");
    return NextResponse.json({ message: "No se pudo guardar la plantilla." }, { status: 500 });
  }
}
