//src/app/panel/profesional/horarios/page.js

import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { getAvailability } from "@/actions/availability-actions";
import DashboardNav from "@/components/DashboardNav";

// CORRECCIÓN: El nombre del archivo debe coincidir EXACTAMENTE (Mayúsculas/Minúsculas)
import AvailabilityForm from "@/components/AvailabilityForm"; 

export default async function HorariosPage() {
  const session = await getSession();

  if (!session || session.role !== "PROFESSIONAL") {
    redirect("/ingresar");
  }

  const professionalId = session.profile.id;

  // Cargar datos existentes
  const { data: availability } = await getAvailability();

  return (
    <div className="bg-gray-50 py-12 min-h-screen">
      <div className="container mx-auto px-6 max-w-5xl">
        
        {/* Header */}
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
              <AvailabilityForm initialData={availability || []} />
           </div>
        </div>

      </div>
    </div>
  );
}