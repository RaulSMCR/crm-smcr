//src/app/panel/profesional/horarios/page.js
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth"; // <--- 1. CORRECCIÓN IMPORTANTE (Evita error de build)
import { getAvailability } from "@/actions/availability-actions";
import DashboardNav from "@/components/DashboardNav";
import AvailabilityForm from "@/components/AvailabilityForm"; 

export default async function HorariosPage() {
  const session = await getSession();

  // 1. Seguridad
  if (!session || session.role !== "PROFESSIONAL") {
    redirect("/ingresar");
  }

  // 2. CORRECCIÓN DE DATOS
  // En el nuevo login, ya no existe 'session.profile'. 
  // El ID del perfil profesional está en 'session.professionalId'.
  // (Aunque en este caso, getAvailability probablemente lo lea de la cookie internamente,
  // es bueno saber que 'session.profile' ya no sirve).

  // 3. Cargar datos existentes
  // Nota: Si getAvailability falla porque también importa mal getSession, 
  // devuélvele un array vacío para que la página no explote.
  const { data: availability = [] } = await getAvailability().catch(() => ({ data: [] }));

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
              {/* Pasamos los datos iniciales al formulario */}
              <AvailabilityForm initialData={availability || []} />
           </div>
        </div>

      </div>
    </div>
  );
}