// src/app/servicios/page.js
import ServiceCard from "@/components/ServiceCard";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Esta función especial le dice a Next.js que obtenga los datos
// de la base de datos antes de construir la página.
async function getServicesFromDb() {
  const services = await prisma.service.findMany({
    include: {
      professional: true, // También trae la información del profesional asociado
    },
  });
  return services;
}

// Convertimos el componente de la página en una función 'async'
export default async function ServiciosPage() {
  // Llamamos a la función para obtener los servicios reales de la BD
  const services = await getServicesFromDb();

  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">
          Nuestros Servicios
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            // Pasamos los datos del servicio a la tarjeta.
            // ServiceCard espera 'professionalName', así que lo extraemos del objeto anidado.
            <ServiceCard 
              key={service.id} 
              service={{
                ...service,
                professionalName: service.professional.name 
              }} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}