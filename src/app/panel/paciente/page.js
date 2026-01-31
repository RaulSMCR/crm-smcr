//src/app/panel/paciente/page.js
import { redirect } from "next/navigation";
import { getSession, logout } from "@/actions/auth-actions"; 
import { getUserAppointments } from "@/actions/appointment-actions"; // 👈 Importamos la nueva action
import DashboardNav from "@/components/DashboardNav";
import UserAppointmentsPanel from "@/components/UserAppointmentsPanel";

export default async function PacienteDashboardPage() {
  // 1. Auth Check
  const session = await getSession();
  if (!session || !session.profile) redirect("/ingresar");
  if (session.role !== "USER") redirect("/login"); // O a su panel correspondiente

  // 2. Data Fetching (EN PARALELO AL RENDER) 🚀
  // Buscamos las citas directamente aquí. Es instantáneo porque es servidor-a-servidor.
  const appointments = await getUserAppointments(session.profile.id);

  return (
    <div className="bg-gray-50 py-12 min-h-screen">
      <div className="container mx-auto px-6">
        
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Panel de Paciente</h1>
            <p className="text-lg text-gray-600">
              Hola, {session.profile.name}. Tienes {appointments.length} citas registradas.
            </p>
          </div>
          
          <form action={logout}>
            <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-red-700 transition-colors">
              Cerrar Sesión
            </button>
          </form>
        </div>

        <DashboardNav />
        
        {/* 3. Inyección de Datos */}
        {/* Le pasamos las citas YA cargadas (initialData). 
            El componente ya no tiene que cargar nada, solo mostrar. */}
        <UserAppointmentsPanel initialAppointments={appointments} />
        
      </div>
    </div>
  );
}