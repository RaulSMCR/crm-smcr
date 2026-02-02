//src/app/agendar/[id]/page.js
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BookingInterface from '@/components/booking/BookingInterface';

export default async function AgendarPage({ params, searchParams }) {
  const { id } = params;
  // Opcional: Si la URL trae ?serviceId=..., podemos usarlo para preseleccionar
  const preSelectedServiceId = searchParams?.serviceId;

  // 1. Buscamos al profesional (Perfil + Usuario)
  const professional = await prisma.professionalProfile.findUnique({
    where: { id }, // El ID de la URL es el del Perfil
    include: {
      // Obtenemos nombre y foto de la tabla User
      user: {
        select: {
          name: true,
          image: true
        }
      },
      // Traemos servicios para mostrar precio/titulo
      services: {
        select: { id: true, title: true, price: true } 
      }
    }
  });

  if (!professional) {
    return notFound();
  }

  // 2. Lógica de Selección de Servicio
  // Si vino un ID por URL, buscamos ese. Si no, tomamos el primero.
  let selectedService = null;
  
  if (preSelectedServiceId) {
    selectedService = professional.services.find(s => s.id === preSelectedServiceId);
  }
  
  // Fallback al primero o a un objeto default
  const activeService = selectedService || professional.services[0] || { 
    id: null,
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
                    {/* CORRECCIÓN JSX: professional.user.image */}
                    {professional.user.image ? (
                        <img src={professional.user.image} alt={professional.user.name} className="w-full h-full object-cover"/>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400 font-bold">
                            {/* CORRECCIÓN JSX: professional.user.name */}
                            {professional.user.name.charAt(0)}
                        </div>
                    )}
                </div>
                {/* CORRECCIÓN JSX: professional.user.name */}
                <h1 className="text-2xl font-bold text-gray-900">{professional.user.name}</h1>
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
                servicePrice={Number(activeService.price)}
                serviceTitle={activeService.title}
                serviceId={activeService.id} // Pasamos el ID real si existe
            />
        </div>

      </div>
    </div>
  );
}