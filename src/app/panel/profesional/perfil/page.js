//src/app/panel/profesional/perfil/page.js
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth"; // <--- 1. CORRECCIÓN: Import directo
import { prisma } from "@/lib/prisma";
import DashboardNav from "@/components/DashboardNav";
import ProfileEditor from "@/components/profile/ProfileEditor";
import ServicesManager from "@/components/profile/ServicesManager";

export default async function PerfilPage() {
  const session = await getSession();

  // 1. Seguridad: Verificar sesión y rol
  if (!session || session.role !== "PROFESSIONAL") {
    redirect("/ingresar");
  }

  // 2. Cargar Datos: Adaptado al nuevo Schema (ProfessionalProfile + User)
  const professionalProfile = await prisma.professionalProfile.findUnique({
    // Usamos 'professionalId' que guardamos en el token durante el login
    where: { id: session.professionalId }, 
    include: {
      services: true,
      // IMPORTANTE: Traemos los datos personales (Nombre, Email, Foto) de la tabla User
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

  if (!professionalProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-md">
          <h2 className="text-red-600 font-bold mb-2">Error de Perfil</h2>
          <p className="text-gray-600">No se encontró el perfil asociado a esta cuenta.</p>
        </div>
      </div>
    );
  }

  // 3. Preparación de Datos (Adelantando trabajo)
  // El componente ProfileEditor probablemente espera un objeto plano con "name", "email", etc.
  // Aquí fusionamos los datos del User dentro del objeto principal para que el componente hijo no se rompa.
  const profileForEditor = {
    ...professionalProfile,       // Bio, Specialty, Slug...
    name: professionalProfile.user.name,
    email: professionalProfile.user.email,
    image: professionalProfile.user.image,
    phone: professionalProfile.user.phone || professionalProfile.phone, // Prioridad al del usuario
  };

  return (
    <div className="bg-gray-50 py-12 min-h-screen">
      <div className="container mx-auto px-6 max-w-5xl">
        
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Mi Perfil Profesional</h1>
        <p className="text-gray-600 mb-8">Administra tu información pública y los servicios que ofreces.</p>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           {/* Menú Lateral */}
           <div className="lg:col-span-1">
              <DashboardNav />
           </div>
           
           {/* Contenido Principal */}
           <div className="lg:col-span-3 space-y-8">
              
              {/* 1. Datos Personales */}
              {/* Pasamos el objeto fusionado para facilitar la vida al componente hijo */}
              <ProfileEditor profile={profileForEditor} />

              {/* 2. Gestión de Servicios */}
              <ServicesManager services={professionalProfile.services} />

           </div>
        </div>

      </div>
    </div>
  );
}