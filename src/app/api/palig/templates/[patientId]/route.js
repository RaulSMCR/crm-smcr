import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePaligOperator } from "@/lib/palig-auth";
import { PALIG_PROFESSIONAL_SLUG, esPalig } from "@/lib/palig-policy";
import { completarPalig, moverFechaPalig, muestraFechaPalig, prepararPlantillaPalig, PaligError } from "@/lib/palig-pdf";
import { descargarPlantillaPalig, leerArchivoPalig, guardarPalig, nombreDePlantilla } from "@/lib/palig-storage";
import { WHATSAPP_PHONE } from "@/lib/contact-info";

/** El teléfono de la empresa como se escribe en el formulario: 71291909. */
const TELEFONO_EMPRESA = WHATSAPP_PHONE.replace(/^506/, "");

async function context(patientId) {
  const auth = await requirePaligOperator();
  if (auth.error) return auth;
  const professional = await prisma.professionalProfile.findUnique({ where: { slug: PALIG_PROFESSIONAL_SLUG }, select: {
    id: true, specialty: true, licenseNumber: true, user: { select: { name: true, phone: true } },
  } });
  const patient = professional && await prisma.user.findFirst({ where: {
    id: patientId,
    OR: [
      { appointments: { some: { professionalId: professional.id } } },
      { casosComoPaciente: { some: { professionalId: professional.id } } },
    ],
  }, select: { id: true, name: true, birthDate: true, insuranceName: true, insuranceTemplateUrl: true } });
  if (!patient || !esPalig(patient.insuranceName)) return { error: NextResponse.json({ message: "Paciente no disponible para PALIG." }, { status: 404 }) };
  return { auth, patient, professional: { ...professional, telefonoEmpresa: TELEFONO_EMPRESA } };
}

const pdf = (bytes, nombre, enLinea = false) => new Response(bytes, { headers: {
  "Content-Type": "application/pdf",
  "Content-Disposition": `${enLinea ? "inline" : "attachment"}; filename="${nombre}"`,
  "Cache-Control": "no-store",
} });

/**
 * GET
 *   ?guardada=1  la plantilla que Raúl guardó, tal cual.
 *   ?muestra=1   la plantilla guardada con una fecha de ejemplo (vista previa).
 *   sin nada     el formulario en blanco precargado con el perfil, para armarla.
 */
export async function GET(request, { params }) {
  const ctx = await context((await params).patientId);
  if (ctx.error) return ctx.error;
  const query = new URL(request.url).searchParams;
  try {
    if (query.get("guardada") === "1" || query.get("muestra") === "1") {
      if (!ctx.patient.insuranceTemplateUrl) return NextResponse.json({ message: "Este paciente todavía no tiene plantilla guardada." }, { status: 404 });
      const bytes = await descargarPlantillaPalig(ctx.patient.insuranceTemplateUrl, ctx.patient.id);
      if (query.get("guardada") === "1") return pdf(bytes, "PALIG-plantilla-guardada.pdf");
      return pdf(await muestraFechaPalig(bytes), "PALIG-vista-previa.pdf", true);
    }
    const source = await readFile(path.join(process.cwd(), "public/forms/palig-cr-reclamo-2023.pdf"));
    return pdf(await completarPalig(source, ctx), "PALIG-plantilla-editable.pdf");
  } catch (error) {
    if (error instanceof PaligError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "No se pudo preparar la plantilla." }, { status: 500 });
  }
}

/** Guardar la plantilla: la editable de esta pantalla o el papel firmado, escaneado. */
export async function POST(request, { params }) {
  const ctx = await context((await params).patientId);
  if (ctx.error) return ctx.error;
  try {
    const fd = await request.formData();
    if (fd.get("preparadaPorRaul") !== "true") throw new PaligError("Confirme que Raúl completó y revisó la plantilla.");
    const { bytes } = await leerArchivoPalig(fd.get("file"));
    // Se guarda tal como Raúl la subió. En la editable solo se completan, si
    // están vacíos, su nombre, su colegiado y el teléfono de la empresa.
    const { bytes: preparada, tipo } = await prepararPlantillaPalig(bytes, {
      nombre: ctx.professional.user.name, colegiado: ctx.professional.licenseNumber, telefono: TELEFONO_EMPRESA,
    });
    const reference = await guardarPalig("insurance-templates", nombreDePlantilla(ctx.patient.id, tipo), preparada);
    await prisma.user.update({ where: { id: ctx.patient.id }, data: {
      insuranceTemplateUrl: reference, insuranceTemplateUploadedAt: new Date(), insuranceTemplateProId: ctx.professional.id,
    } });
    return NextResponse.json({ ok: true, tipo });
  } catch (error) {
    if (error instanceof PaligError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("[palig] TEMPLATE_SAVE_FAILED");
    return NextResponse.json({ message: "No se pudo guardar la plantilla." }, { status: 500 });
  }
}

/**
 * Mover la fecha de una plantilla escaneada: { dx, dy } en puntos. Se guarda
 * una copia nueva —no se sobrescribe la anterior— y el paciente pasa a usarla.
 */
export async function PATCH(request, { params }) {
  const ctx = await context((await params).patientId);
  if (ctx.error) return ctx.error;
  try {
    if (!ctx.patient.insuranceTemplateUrl) throw new PaligError("Este paciente todavía no tiene plantilla guardada.", 404);
    const body = await request.json().catch(() => ({}));
    const dx = Number(body.dx || 0);
    const dy = Number(body.dy || 0);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 50 || Math.abs(dy) > 50) throw new PaligError("Movimiento no válido.");
    const actual = await descargarPlantillaPalig(ctx.patient.insuranceTemplateUrl, ctx.patient.id);
    const movida = await moverFechaPalig(actual, { dx, dy, cual: ["firma", "fechaFirma"].includes(body.cual) ? body.cual : "fecha" });
    const reference = await guardarPalig("insurance-templates", nombreDePlantilla(ctx.patient.id, "escaneada"), movida);
    await prisma.user.update({ where: { id: ctx.patient.id }, data: { insuranceTemplateUrl: reference } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PaligError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("[palig] TEMPLATE_MOVE_FAILED");
    return NextResponse.json({ message: "No se pudo mover el recuadro." }, { status: 500 });
  }
}
