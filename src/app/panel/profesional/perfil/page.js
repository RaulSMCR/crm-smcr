// src/app/panel/profesional/perfil/page.js
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/profile/ProfileEditor";

// Forzar datos frescos para que si el Admin crea un servicio nuevo, aparezca aquí al instante
export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  // 1. Seguridad: Verificar sesión
  const session = await getSession();

  if (!session || session.role !== "PROFESSIONAL") {
    redirect("/ingresar");
  }

  // 2. Cargar Datos del Profesional (Incluyendo User y Servicios actuales)
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: session.sub }, // Usamos session.sub (ID Usuario) que es más seguro
    include: {
      services: true, // Trae los servicios que YA tiene marcados
      user: {
        select: {
          name: true,
          email: true,
          image: true,
          phone: true
        }
      }
    }
  });

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-xl shadow border border-red-100">
          <h2 className="text-red-600 font-bold mb-2">Error de Perfil</h2>
          <p className="text-slate-600">No se encontró el perfil asociado. Contacta a soporte.</p>
        </div>
      </div>
    );
  }

  // 3. NUEVO: Cargar TODOS los servicios disponibles en el sistema (Activos)
  // Esto llena la lista de opciones para que el médico pueda hacer "Check"
  const allServices = await prisma.service.findMany({
    where: { isActive: true }, // Solo mostramos los habilitados por el Admin
    orderBy: { title: 'asc' }
  });

  return (
    <div className="bg-slate-50 py-10 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Encabezado Simple */}
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800">Mi Perfil Profesional</h1>
            <p className="text-slate-500 mt-2">
                Actualiza tu foto, biografía y selecciona los servicios que ofreces para que los pacientes te encuentren.
            </p>
        </div>

        {/* 4. Renderizamos el Editor ÚNICO 
            Le pasamos el perfil actual y la lista de todos los servicios para elegir.
        */}
        <ProfileEditor profile={profile} allServices={allServices} />

      </div>
    </div>
  );
}