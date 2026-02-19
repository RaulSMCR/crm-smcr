// src/app/panel/profesional/horarios/page.js
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAvailability } from "@/actions/availability-actions";
import AvailabilityForm from "@/components/AvailabilityForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HorariosPage() {
  const session = await getSession();
  if (!session || session.role !== "PROFESSIONAL") redirect("/ingresar");

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
          Define tus días y horas de atención. Estos horarios se usan para mostrar tu disponibilidad.
        </p>
      </div>

      <AvailabilityForm initialData={availabilityData} />
    </div>
  );
}
