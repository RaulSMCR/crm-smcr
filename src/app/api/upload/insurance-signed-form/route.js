// src/app/api/upload/insurance-signed-form/route.js
// Profesional sube la planilla firmada con fecha para un reclamo específico.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSignedClaimToPatient } from "@/lib/insurance-mail";

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PROFESSIONAL") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
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
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede pesar más de 5 MB." }, { status: 400 });
    }

    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: { patient: { select: { name: true, email: true } } },
    });

    if (!claim) return NextResponse.json({ error: "Reclamo no encontrado." }, { status: 404 });
    if (claim.professionalId !== professionalId) {
      return NextResponse.json({ error: "No tiene permiso para este reclamo." }, { status: 403 });
    }

    const path = `${claimId}/signed-form.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const supabaseAdmin = getSupabaseAdmin();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("insurance-signed-forms")
      .upload(path, buffer, { upsert: true, contentType: "application/pdf", cacheControl: "3600" });

    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage.from("insurance-signed-forms").getPublicUrl(path);
    const url = data.publicUrl;

    const now = new Date();
    await prisma.insuranceClaim.update({
      where: { id: claimId },
      data: {
        signedFormUrl: url,
        signedFormUploadedAt: now,
        status: "COMPLETED",
        emailSentAt: now,
      },
    });

    sendSignedClaimToPatient({
      patientEmail: claim.patient.email,
      patientName: claim.patient.name,
      signedFormUrl: url,
    }).catch((e) => console.error("[insurance-signed-form] email error:", e));

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[upload/insurance-signed-form] Error:", err);
    return NextResponse.json({ error: err.message || "Error inesperado." }, { status: 500 });
  }
}
