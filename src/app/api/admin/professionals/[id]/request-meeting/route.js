// src/app/api/admin/professionals/[id]/request-meeting/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
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
      select: { id: true, user: { select: { name: true, email: true } } },
    });

    if (!profile?.user?.email) {
      return NextResponse.json({ message: "No se encontró correo del profesional." }, { status: 404 });
    }

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: "Salud Mental Costa Rica <no-reply@saludmentalcostarica.com>",
        to: profile.user.email,
        subject: "Avanzamos: solicitud de reunión con administración",
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.5; color:#0f172a; max-width:600px; margin:0 auto;">
            <h2>Avanzamos al siguiente paso</h2>
            <p>Hola ${profile.user.name || "profesional"}:</p>
            <p>
              Nos gustaría tener una reunión breve con vos para conocerte y coordinar los detalles
              de tu incorporación.
            </p>
            <p>
              Respondé este correo con los días y horas que te sirvan, y lo agendamos.
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({ ok: true, message: "Solicitud de reunión enviada." });
  } catch (e) {
    console.error("Error request-meeting professional:", e);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
