// src/app/api/admin/professionals/[id]/reject/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://saludmentalcostarica.com";

export async function POST(_request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Acción no permitida" }, { status: 403 });
    }

    const professionalId = params?.id;
    if (!professionalId) {
      return NextResponse.json({ message: "ID de profesional inválido" }, { status: 400 });
    }

    const updated = await prisma.professionalProfile.update({
      where: { id: String(professionalId) },
      data: { isApproved: false },
      select: {
        id: true,
        isApproved: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.user.update({
      where: { id: updated.user.id },
      data: { isActive: false },
    });

    if (process.env.RESEND_API_KEY && updated.user?.email) {
      await resend.emails.send({
        from: "Salud Mental Costa Rica <no-reply@saludmentalcostarica.com>",
        to: updated.user.email,
        subject: "Estado de su postulación profesional",
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.5; color:#0f172a; max-width:600px; margin:0 auto;">
            <h2>Actualización de postulación</h2>
            <p>Estimado/a ${updated.user.name || "profesional"}:</p>
            <p>
              La solicitud ha sido recibida y se tendrá en cuenta para próximas participaciones.
            </p>
            <p>
              Agradecemos el interés en formar parte de la red profesional de Salud Mental Costa Rica.
            </p>
            <p>
              <a href="${BASE_URL}/registro/profesional" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Actualizar postulación</a>
            </p>
          </div>
        `,
      });
    }

    revalidatePath("/panel/admin/personal");
    revalidatePath("/admin/professionals");

    return NextResponse.json({
      id: updated.id,
      isApproved: updated.isApproved,
      name: updated.user?.name || "",
      email: updated.user?.email || "",
      status: "REJECTED",
    });
  } catch (e) {
    if (e?.code === "P2025") {
      return NextResponse.json({ message: "El profesional no existe en la base de datos." }, { status: 404 });
    }
    console.error("Error reject professional:", e);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
