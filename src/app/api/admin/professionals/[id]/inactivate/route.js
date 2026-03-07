// src/app/api/admin/professionals/[id]/inactivate/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (session.role !== "ADMIN") return NextResponse.json({ message: "Acción no permitida" }, { status: 403 });

    const professionalId = String(params?.id || "");
    if (!professionalId) return NextResponse.json({ message: "ID de profesional inválido" }, { status: 400 });

    const profile = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: { id: true, user: { select: { id: true, name: true, email: true } } },
    });

    if (!profile?.user?.id) {
      return NextResponse.json({ message: "Profesional no encontrado." }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: profile.user.id },
      data: { isActive: false },
    });

    if (process.env.RESEND_API_KEY && profile.user.email) {
      await resend.emails.send({
        from: "Salud Mental Costa Rica <no-reply@saludmentalcostarica.com>",
        to: profile.user.email,
        subject: "Atención requerida: cuenta profesional inactivada",
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.5; color:#0f172a; max-width:600px; margin:0 auto;">
            <h2>Actualización importante de su cuenta profesional</h2>
            <p>Estimado/a ${profile.user.name || "profesional"}:</p>
            <p>
              Para proteger la continuidad de la atención y el cuidado de nuestros pacientes,
              su cuenta profesional fue inactivada de forma temporal por administración.
            </p>
            <p>
              Se solicita comunicación urgente con el equipo administrador para revisar su situación
              y definir los próximos pasos.
            </p>
            <p>
              Mientras la cuenta permanezca inactiva, no se agendarán nuevas citas.
            </p>
          </div>
        `,
      });
    }

    revalidatePath("/panel/admin/personal");
    revalidatePath("/admin/professionals");
    revalidatePath("/servicios");

    return NextResponse.json({ ok: true, status: "INACTIVE", message: "Cuenta inactivada correctamente." });
  } catch (e) {
    console.error("Error inactivate professional:", e);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
