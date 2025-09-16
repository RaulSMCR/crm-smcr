// src/app/servicios/[id]/page.js
import Image from 'next/image';
import Link from 'next/link';
import { services } from '@/data/mockData'; // Importamos los datos de nuestro archivo central

export default function ServiceDetailPage({ params }) {
  // 1. Usamos el ID de la URL para encontrar el servicio correcto en nuestros datos.
  const service = services.find(s => s.id.toString() === params.id);

  // 2. Si no se encuentra un servicio con ese ID, mostramos un mensaje.
  if (!service) {
    return (
      <div className="container mx-auto px-6 py-12 text-center">
        <h1 className="text-4xl font-bold">Servicio no encontrado</h1>
        <Link href="/servicios" className="text-brand-primary mt-4 inline-block">
          Volver a la lista de servicios
        </Link>
      </div>
    );
  }

  // 3. Si se encuentra el servicio, mostramos todos sus detalles.
  return (
    <div className="bg-white py-12">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Columna de la Imagen */}
          <div className="relative w-full h-96 rounded-lg overflow-hidden shadow-lg">
            <Image
              src={service.imageUrl}
              alt={`Imagen de ${service.title}`}
              layout="fill"
              objectFit="cover"
            />
          </div>

          {/* Columna de la Información */}
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{service.title}</h1>
            <p className="text-lg text-gray-600 mb-4">Un servicio de: {service.professionalName}</p>
            <p className="text-gray-700 mb-6">{service.description}</p>
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
              <span className="text-3xl font-bold text-brand-primary">${service.price}</span>
              <button className="bg-brand-primary text-white font-bold px-8 py-3 rounded-md text-lg hover:bg-opacity-90 transition duration-300">
                Agendar Cita
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}