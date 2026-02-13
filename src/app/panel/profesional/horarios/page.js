// src/app/panel/profesional/horarios/page.js
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAvailability } from "@/actions/availability-actions";
import DashboardNav from "@/components/DashboardNav";
import AvailabilityForm from "@/components/AvailabilityForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HorariosPage() {
  const session = await getSession();

  if (!session || session.role !== "PROFESSIONAL") {
    redirect("/ingresar");
  }

  let availabilityData = [];

  try {
    const response = await getAvailability();
    if (response?.success && Array.isArray(response.data)) {
      availabilityData = response.data;
    }
  } catch (error) {
    console.error("⚠️ Error cargando horarios (Carga Resiliente):", error);
    availabilityData = [];
  }

  return (
    <div className="bg-gray-50 py-12 min-h-screen">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Configuración de Horarios</h1>
          <p className="text-gray-600 mt-2">
            Define tus días y horas de atención. Estos horarios se usarán para mostrar tu disponibilidad a los pacientes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <DashboardNav />
          </div>

          <div className="lg:col-span-3">
            <AvailabilityForm initialData={availabilityData} />
          </div>
        </div>
      </div>
    </div>
  );
}
