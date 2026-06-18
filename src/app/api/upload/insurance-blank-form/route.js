// src/app/api/upload/insurance-blank-form/route.js
// Admin sube el formulario de reclamo en blanco al perfil del paciente.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInsurancePatientFormAlert } from "@/lib/insurance-mail";

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
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

    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: { id: true, name: true, email: true },
    });
    if (!patient) return NextResponse.json({ error: "Paciente no encontrado." }, { status: 404 });

    const path = `${patientId}/blank-form.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const supabaseAdmin = getSupabaseAdmin();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("insurance-blank-forms")
      .upload(path, buffer, { upsert: true, contentType: "application/pdf", cacheControl: "3600" });

    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage.from("insurance-blank-forms").getPublicUrl(path);
    const url = data.publicUrl;

    await prisma.user.update({
      where: { id: patientId },
      data: { insuranceBlankFormUrl: url, insuranceBlankFormUploadedAt: new Date() },
    });

    sendInsurancePatientFormAlert({
      patientEmail: patient.email,
      patientName: patient.name,
      blankFormUrl: url,
    }).catch((e) => console.error("[insurance-blank-form] email error:", e));

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload/insurance-blank-form] Error:", err);
    return NextResponse.json({ error: err.message || "Error inesperado." }, { status: 500 });
  }
}
