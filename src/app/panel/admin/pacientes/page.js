// src/app/panel/admin/pacientes/page.js
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import { ESTADOS } from "@/lib/casos-policy";
import PacientesEmparejamiento from "@/components/admin/PacientesEmparejamiento";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EN_CURSO = [ESTADOS.ABIERTO, ESTADOS.PENDIENTE_VISADO];

export default async function AdminPacientesPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const [usuarios, perfiles] = await Promise.all([
    prisma.user.findMany({
      where: { role: "USER", isActive: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        casosComoPaciente: {
          where: { estado: { in: EN_CURSO } },
          select: { professionalId: true, professional: { select: { user: { select: { name: true } } } } },
        },
      },
    }),
    prisma.professionalProfile.findMany({
      where: { isApproved: true, user: { isActive: true } },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const pacientes = usuarios.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    createdAt: u.createdAt.toISOString(),
    profesionales: u.casosComoPaciente.map((c) => ({
      id: c.professionalId,
      name: c.professional?.user?.name || "Profesional",
    })),
  }));
  const profesionales = perfiles.map((p) => ({ id: p.id, name: p.user?.name || "Profesional" }));

  return (
    <div className="min-h-screen bg-appbg p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/panel/admin" className="text-sm text-slate-500 hover:text-slate-700">
            ← Panel admin
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Pacientes</h1>
        </div>
        <p className="text-sm text-slate-600">
          Quien agenda por la web queda emparejado solo con su profesional. Acá se empareja a quien llegó por otra
          vía: se registró sin agendar, pidió cita por WhatsApp o ya se atendía de antes. Un paciente puede estar
          con varios profesionales a la vez.
        </p>
        <PacientesEmparejamiento pacientes={pacientes} profesionales={profesionales} />
      </div>
    </div>
  );
}
