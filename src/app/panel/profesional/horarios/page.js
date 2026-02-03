// src/app/panel/profesional/horarios/page.js
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAvailability } from "@/actions/availability-actions";
import DashboardNav from "@/components/DashboardNav";
import AvailabilityForm from "@/components/AvailabilityForm"; 

// 🛑 BLINDAJE PARA VERCEL (VITAL)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HorariosPage() {
  // 1. Verificación de Sesión
  const session = await getSession();

  if (!session || session.role !== "PROFESSIONAL") {
    redirect("/ingresar");
  }

  // 2. Cargar datos con RED DE SEGURIDAD
  let availabilityData = [];
  
  try {
    // Intentamos traer los horarios
    const response = await getAvailability();
    if (response && response.data) {
      availabilityData = response.data;
    }
  } catch (error) {
    // Si la BD falla, no rompemos la página. 
    // Mostramos error en consola interna y cargamos el formulario vacío.
    console.error("⚠️ Error cargando horarios (Carga Resiliente):", error);
    availabilityData = []; 
  }

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
              {/* Pasamos los datos (o array vacío si falló la BD) */}
              <AvailabilityForm initialData={availabilityData} />
           </div>
        </div>

      </div>
    </div>
  );
}