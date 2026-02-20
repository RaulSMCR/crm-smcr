// src/app/panel/profesional/perfil/page.js
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/profile/ProfileEditor";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await getSession();
  if (!session || session.role !== "PROFESSIONAL") redirect("/ingresar");

  const profileRaw = await prisma.professionalProfile.findUnique({
    where: { userId: String(session.sub) },
    include: {
      serviceAssignments: { include: { service: true } },
      user: { select: { name: true, email: true, image: true, phone: true } },
    },
  });

  if (!profileRaw) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h2 className="text-2xl font-bold text-slate-800">Error de Perfil</h2>
        <p className="mt-2 text-slate-600">
          No se encontró el perfil asociado. Contacta a soporte.
        </p>
      </div>
    );
  }

  const allServicesRaw = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
  });

  // ✅ Serializar Decimal -> number para props de componente client
  const allServices = allServicesRaw.map((s) => ({ ...s, price: Number(s.price) }));

  const profile = {
    ...profileRaw,
    serviceAssignments: (profileRaw.serviceAssignments || []).map((a) => ({
      ...a,
      service: a.service ? { ...a.service, price: Number(a.service.price) } : a.service,
    })),
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Mi Perfil Profesional</h1>
        <p className="text-slate-500 mt-2">
          Selecciona los servicios que ofreces. Los servicios nuevos quedan en revisión hasta que el administrador los apruebe.
        </p>
      </div>

      <ProfileEditor profile={profile} allServices={allServices} />
    </div>
  );
}
