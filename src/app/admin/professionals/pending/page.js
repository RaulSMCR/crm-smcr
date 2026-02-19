// src/app/admin/professionals/pending/page.js
import { prisma } from "@/lib/prisma";
import PendingProfessionalsList from "@/components/admin/PendingProfessionalsList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profesionales Pendientes | Admin",
};

export default async function PendingProfessionalsPage() {
  const users = await prisma.user.findMany({
    where: {
      role: "PROFESSIONAL",
      professionalProfile: {
        is: { isApproved: false },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      professionalProfile: {
        select: {
          specialty: true,
          licenseNumber: true,
          bio: true,
          cvUrl: true,
        },
      },
      createdAt: true,
    },
    take: 200,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Solicitudes Pendientes</h1>
      <p className="text-slate-500">Revisa y aprueba a los nuevos profesionales registrados.</p>

      <div className="text-sm text-slate-600">
        {users.length} Pendiente{users.length !== 1 && "s"}
      </div>

      <PendingProfessionalsList users={users} />
    </div>
  );
}
