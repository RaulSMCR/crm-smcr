// src/app/api/upload/insurance-patient-form/route.js
// Paciente sube el formulario con sus datos completados.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInsuranceProTemplateAlert } from "@/lib/insurance-mail";
import { fileApiUrl, uploadPrivate, validateFileSignature } from "@/lib/storage";

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "USER") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const userId = String(session.userId || session.sub);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede pesar más de 5 MB." }, { status: 400 });
    }

    const patient = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, insuranceBlankFormUrl: true },
    });
    if (!patient?.insuranceBlankFormUrl) {
      return NextResponse.json({ error: "El formulario en blanco aún no está disponible." }, { status: 400 });
    }

    const path = `${userId}/patient-form.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateFileSignature(buffer, ["application/pdf"])) {
      return NextResponse.json({ error: "El contenido del archivo no es un PDF válido." }, { status: 400 });
    }
    await uploadPrivate("insurance-patient-forms", path, buffer, "application/pdf");
    const url = fileApiUrl("insurance-patient-forms", path);

    await prisma.user.update({
      where: { id: userId },
      data: { insurancePatientFormUrl: "insurance-patient-forms/" + path, insurancePatientFormUploadedAt: new Date() },
    });

    // Notificar al profesional más reciente del paciente
    const lastAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: userId,
        status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"] },
      },
      orderBy: { date: "desc" },
      include: { professional: { include: { user: { select: { email: true } } } } },
    });

    if (lastAppointment?.professional?.user?.email) {
      sendInsuranceProTemplateAlert({
        proEmail: lastAppointment.professional.user.email,
        patientName: patient.name,
        patientFormUrl: url,
      }).catch((e) => console.error("[insurance-patient-form] email error:", e));
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload/insurance-patient-form] Error:", err);
    return NextResponse.json({ error: err.message || "Error inesperado." }, { status: 500 });
  }
}
