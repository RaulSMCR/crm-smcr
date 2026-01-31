//src/app/agendar/[id]/page.js
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BookingInterface from '@/components/booking/BookingInterface';

export default async function AgendarPage({ params }) {
  const { id } = params;

  // 1. Buscamos al profesional
  const professional = await prisma.professional.findUnique({
    where: { id },
    include: {
        services: {
            take: 1, // Por ahora tomamos el primer servicio por defecto
            select: { id: true, title: true, price: true } 
        }
    }
  });

  if (!professional) {
    return notFound();
  }

  // Datos del servicio por defecto (esto luego se puede mejorar para elegir servicio)
  const defaultService = professional.services[0] || { 
    title: "Consulta General", 
    price: 50 
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: Perfil del Profesional */}
        <div className="md:col-span-5 lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
                <div className="w-32 h-32 mx-auto rounded-full bg-gray-200 mb-4 overflow-hidden border-4 border-white shadow-md">
                    {professional.avatarUrl ? (
                        <img src={professional.avatarUrl} alt={professional.name} className="w-full h-full object-cover"/>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400 font-bold">
                            {professional.name.charAt(0)}
                        </div>
                    )}
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{professional.name}</h1>
                <p className="text-blue-600 font-medium">{professional.specialty || 'Profesional de Salud'}</p>
                
                {professional.bio && (
                    <p className="text-gray-500 text-sm mt-4 leading-relaxed">
                        {professional.bio}
                    </p>
                )}
            </div>

            {/* Tarjeta de Garantía / Confianza */}
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    🛡️ Reserva Segura
                </h4>
                <ul className="text-sm text-blue-800 space-y-2">
                    <li>✓ Confirmación inmediata</li>
                    <li>✓ Recordatorios por email</li>
                    <li>✓ Cancelación flexible</li>
                </ul>
            </div>
        </div>

        {/* COLUMNA DERECHA: Interfaz de Calendario */}
        <div className="md:col-span-7 lg:col-span-8">
            <BookingInterface 
                professionalId={professional.id}
                servicePrice={Number(defaultService.price)}
                serviceTitle={defaultService.title}
            />
        </div>

      </div>
    </div>
  );
}