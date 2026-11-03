// src/app/pro/acuerdos/page.js — «Acuerdos» en la app de profesionales.
// Los mismos acuerdos de atención del panel: pacientes en tratamiento con
// sesiones fijas (cada semana, dos o cuatro semanas) sin fecha de fin.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { wherePacientesDelProfesional } from "@/lib/casos";
import { datosDeAcuerdos } from "@/lib/pro/datos-de-acuerdos";
import AcuerdosDeAtencionSection from "@/components/appointments/AcuerdosDeAtencionSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acuerdos" };

export default async function ProAcuerdosPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/pro/acuerdos");
  const professionalId = String(session.professionalProfileId || "");

  const [acuerdos, patients] = await Promise.all([
    datosDeAcuerdos(professionalId),
    prisma.user.findMany({
      where: wherePacientesDelProfesional(professionalId),
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <AcuerdosDeAtencionSection patients={patients} {...acuerdos} />;
}
