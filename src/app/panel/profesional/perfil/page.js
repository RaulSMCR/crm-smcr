// src/app/panel/profesional/perfil/page.js
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/profile/ProfileEditor";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await getSession();
  if (!session || session.role !== "PROFESSIONAL") {
    redirect("/ingresar");
  }

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: session.sub },
    include: {
      serviceAssignments: {
        include: { service: true },
      },
      user: {
        select: { name: true, email: true, image: true, phone: true },
      },
    },
  });

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <h2 className="text-2xl font-bold">Error de Perfil</h2>
        <p className="mt-2 text-slate-600">
          No se encontró el perfil asociado. Contacta a soporte.
        </p>
      </div>
    );
  }

  const allServices = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mi Perfil Profesional</h1>
        <p className="text-slate-600 mt-2">
          Selecciona los servicios que ofreces. Los servicios nuevos quedan <b>en revisión</b> hasta que el
          administrador los apruebe.
        </p>
      </div>

      <ProfileEditor profile={profile} allServices={allServices} />
    </div>
  );
}
