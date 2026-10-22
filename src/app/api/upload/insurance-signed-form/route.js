// src/app/api/upload/insurance-signed-form/route.js
// Profesional sube la planilla firmada con fecha para un reclamo específico.
import { NextResponse } from "next/server";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSignedClaimToPatient } from "@/lib/insurance-mail";
import { uploadPrivate, validateFileSignature } from "@/lib/storage";
import { facturaPaligPdf } from "@/lib/palig-pdf";
import { FE_EMISOR } from "@/lib/fe/config";

const TIPOS_ADMITIDOS = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PROFESSIONAL") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (isPreviewSession(session)) {
      return NextResponse.json({ error: PREVIEW_BLOCKED_MESSAGE }, { status: 403 });
    }

    const professionalId = String(session.professionalProfileId || "");
    if (!professionalId) {
      return NextResponse.json({ error: "Perfil profesional no encontrado." }, { status: 403 });
    }

    const profile = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: { isApproved: true },
    });
    if (!profile?.isApproved) {
      return NextResponse.json({ error: "El perfil profesional no está aprobado." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const claimId = String(formData.get("claimId") || "").trim();

    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    if (!claimId) return NextResponse.json({ error: "claimId requerido." }, { status: 400 });
    // El formulario firmado se escanea o se fotografía: PDF, JPG o PNG.
    const extension = TIPOS_ADMITIDOS[file.type];
    if (!extension) {
      return NextResponse.json({ error: "Suba el formulario firmado en PDF, JPG o PNG." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede pesar más de 5 MB." }, { status: 400 });
    }

    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: {
        patient: { select: { name: true, email: true } },
        invoice: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
      },
    });

    if (!claim) return NextResponse.json({ error: "Reclamo no encontrado." }, { status: 404 });
    if (claim.professionalId !== professionalId) {
      return NextResponse.json({ error: "No tiene permiso para este reclamo." }, { status: 403 });
    }

    const path = `${claimId}/signed-form.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateFileSignature(buffer, [file.type])) {
      return NextResponse.json({ error: "El contenido del archivo no coincide con su tipo." }, { status: 400 });
    }
    await uploadPrivate("insurance-signed-forms", path, buffer, file.type);

    const now = new Date();
    await prisma.insuranceClaim.update({
      where: { id: claimId },
      data: {
        signedFormUrl: "insurance-signed-forms/" + path,
        signedFormUploadedAt: now,
        status: "COMPLETED",
      },
    });

    // La factura va adjunta si Hacienda ya la aceptó; facturaPaligPdf se niega
    // a dibujar una factura pendiente, y entonces el correo lo aclara.
    let factura = null;
    if (claim.invoice) {
      try {
        factura = { filename: `Factura-${claim.invoice.invoiceNumber}.pdf`, content: await facturaPaligPdf(claim.invoice, FE_EMISOR) };
      } catch {
        factura = null;
      }
    }

    const emailSent = await sendSignedClaimToPatient({
      patientEmail: claim.patient.email,
      patientName: claim.patient.name,
      formulario: { filename: `Formulario-reclamo-firmado.${extension}`, content: buffer },
      factura,
    });
    // Se anota solo si el correo salió de verdad: antes se anotaba siempre.
    if (emailSent) {
      await prisma.insuranceClaim.update({ where: { id: claimId }, data: { emailSentAt: new Date() } });
    }

    return NextResponse.json({ ok: true, emailSent, facturaAdjunta: Boolean(factura) });
  } catch (err) {
    console.error("[upload/insurance-signed-form] Error:", err);
    return NextResponse.json({ error: err.message || "Error inesperado." }, { status: 500 });
  }
}
