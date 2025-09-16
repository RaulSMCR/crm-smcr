// src/app/servicios/page.js

import ServiceCard from "@/components/ServiceCard";
import { services } from "@/data/mockData"; // Importamos los datos desde nuestro archivo central

export default function ServiciosPage() {
  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">
          Nuestros Servicios
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </div>
    </div>
  );
}