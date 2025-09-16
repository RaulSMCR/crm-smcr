// src/components/ServiceCard.js
import Image from 'next/image';
import Link from 'next/link';

export default function ServiceCard({ service }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <div className="relative w-full h-48">
        <Image
          src={service.imageUrl}
          alt={`Imagen de ${service.title}`}
          layout="fill"
          objectFit="cover"
        />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{service.title}</h3>
        <p className="text-sm text-gray-600 mb-4">Por: {service.professionalName}</p>
        <p className="text-gray-700 mb-4 line-clamp-2">{service.description}</p>
        <div className="flex justify-between items-center mt-4">
          <span className="text-lg font-bold text-brand-primary">${service.price}</span>

          {/* ESTA ES LA PARTE QUE CREA EL BOTÓN */}
          <Link href={`/servicios/${service.id}`} className="bg-brand-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-opacity-90 transition-transform transform hover:scale-105">
            Ver Detalles
          </Link>

        </div>
      </div>
    </div>
  );
}