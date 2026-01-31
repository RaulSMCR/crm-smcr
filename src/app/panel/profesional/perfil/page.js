import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import DashboardNav from "@/components/DashboardNav";
import ProfileEditor from "@/components/profile/ProfileEditor";
import ServicesManager from "@/components/profile/ServicesManager";

export default async function PerfilPage() {
  const session = await getSession();

  if (!session || session.role !== "PROFESSIONAL") {
    redirect("/ingresar");
  }

  // Cargar datos frescos del profesional + sus servicios
  const professional = await prisma.professional.findUnique({
    where: { id: session.profile.id },
    include: {
      services: true
    }
  });

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
              <ProfileEditor profile={professional} />

              {/* 2. Gestión de Servicios */}
              <ServicesManager services={professional.services} />

           </div>
        </div>

      </div>
    </div>
  );
}