// src/app/panel/profesional/horarios/page.js
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAvailability } from "@/actions/availability-actions";
import AvailabilityForm from "@/components/AvailabilityForm";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TZ } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HorariosPage() {
  const session = await getSession();
  if (!session || session.role !== "PROFESSIONAL") redirect("/ingresar");

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: String(session.sub) },
    select: { googleRefreshToken: true },
  });

  let availabilityData = [];
  try {
    const response = await getAvailability();
    if (response?.success && Array.isArray(response.data)) availabilityData = response.data;
  } catch (error) {
    console.error("⚠️ Error cargando horarios:", error);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Configuración de Horarios</h1>
        <p className="text-slate-500 mt-2">
          Define tus días y horas de atención. Estos horarios se usan para mostrar tu disponibilidad en zona horaria de Costa Rica ({DEFAULT_TZ}).
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <div>
          Google Calendar: <span className="font-semibold">{profile?.googleRefreshToken ? "Conectado" : "Sin conectar"}</span>
        </div>
        {!profile?.googleRefreshToken && (
          <Link href="/panel/profesional/integraciones" className="mt-2 inline-flex text-blue-700 hover:underline">
            Conectar Google Calendar para sincronizar automáticamente tus citas
          </Link>
        )}
      </div>

      <AvailabilityForm initialData={availabilityData} />
    </div>
  );
}
