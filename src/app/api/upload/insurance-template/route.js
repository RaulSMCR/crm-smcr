// src/app/api/upload/insurance-template/route.js
// Profesional sube la plantilla con sus datos (sin fecha) para un paciente.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInsuranceProSignAlert } from "@/lib/insurance-mail";

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
      select: { isApproved: true, user: { select: { email: true } } },
    });
    if (!profile?.isApproved) {
      return NextResponse.json({ error: "El perfil profesional no está aprobado." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const patientId = String(formData.get("patientId") || "").trim();

    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    if (!patientId) return NextResponse.json({ error: "patientId requerido." }, { status: 400 });
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede pesar más de 5 MB." }, { status: 400 });
    }

    // Verificar que el profesional tiene citas con ese paciente
    const hasAppointment = await prisma.appointment.findFirst({
      where: { patientId, professionalId },
    });
    if (!hasAppointment) {
      return NextResponse.json({ error: "No se encontró relación con este paciente." }, { status: 403 });
    }

    const path = `${patientId}/template.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const supabaseAdmin = getSupabaseAdmin();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("insurance-templates")
      .upload(path, buffer, { upsert: true, contentType: "application/pdf", cacheControl: "3600" });

    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage.from("insurance-templates").getPublicUrl(path);
    const url = data.publicUrl;

    const patient = await prisma.user.update({
      where: { id: patientId },
      data: {
        insuranceTemplateUrl: url,
        insuranceTemplateUploadedAt: new Date(),
        insuranceTemplateProId: professionalId,
      },
      select: { name: true, insuranceName: true },
    });

    // Procesar claims AWAITING_TEMPLATE de este paciente
    const awaitingClaims = await prisma.insuranceClaim.findMany({
      where: { patientId, status: "AWAITING_TEMPLATE" },
    });

    for (const claim of awaitingClaims) {
      await prisma.insuranceClaim.update({
        where: { id: claim.id },
        data: { status: "PENDING_SIGNED_FORM" },
      });

      sendInsuranceProSignAlert({
        proEmail: profile.user.email,
        patientName: patient.name,
        insuranceName: patient.insuranceName,
        paymentDate: claim.paymentDate,
        templateUrl: url,
      }).catch((e) => console.error("[insurance-template] sign-alert error:", e));
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload/insurance-template] Error:", err);
    return NextResponse.json({ error: err.message || "Error inesperado." }, { status: 500 });
  }
}
