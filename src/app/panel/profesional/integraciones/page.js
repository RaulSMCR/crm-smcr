import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import GoogleConnectButton from "@/components/admin/GoogleConnectButton";

export const dynamic = "force-dynamic";

export default async function IntegracionesPage() {
  const session = await getSession();
  if (!session?.sub || session.role !== "PROFESSIONAL") redirect("/ingresar");

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: String(session.sub) },
    select: { id: true, googleRefreshToken: true },
  });

  if (!profile) redirect("/panel/profesional");

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Calendario e integraciones</h1>
        <p className="text-slate-500 mt-2">Conecta tu Google Calendar para sincronizar citas automáticamente.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="text-sm text-slate-700">
          Estado actual: {profile.googleRefreshToken ? "Conectado" : "Sin conectar"}
        </div>
        <GoogleConnectButton />
      </div>
    </div>
  );
}
