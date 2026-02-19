//src/app/panel/profesional/ApprovalStatusBanner.js

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export default async function ApprovalStatusBanner() {
  noStore();

  const session = await getSession();
  if (!session) redirect("/ingresar?next=/panel/profesional");

  const me = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    include: { professionalProfile: true },
  });

  if (!me || me.role !== "PROFESSIONAL") redirect("/panel/paciente");

  const approved = Boolean(me.professionalProfile?.isApproved);

  if (approved) {
    return (
      <div className="mb-6 bg-green-50 text-green-800 p-4 rounded-lg text-sm border border-green-200 font-medium flex items-center gap-2">
        ✅ Tu perfil está aprobado y activo en la plataforma.
      </div>
    );
  }

  return (
    <div className="mb-6 bg-yellow-50 text-yellow-900 p-4 rounded-lg text-sm border border-yellow-200 font-medium">
      <div className="flex items-center gap-2">
        🕒 <span className="font-bold">Perfil en revisión</span>
      </div>
      <p className="mt-1">
        Si ya verificaste tu correo, el siguiente paso es la entrevista y aprobación del equipo.
      </p>
    </div>
  );
}
