//src/components/booking/BookingInterface.js

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Necesario para redirigir
import { getAvailableSlots, requestAppointment } from '@/actions/booking-actions'; // Importamos la acción real
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BookingInterface({ professionalId, servicePrice, serviceTitle, serviceId }) {
  const router = useRouter();
  
  // Estado para fecha seleccionada (inicia mañana)
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const [slots, setSlots] = useState([]); // Horarios disponibles
  const [loading, setLoading] = useState(false); // Cargando slots
  const [selectedSlot, setSelectedSlot] = useState(null); // Hora elegida
  const [isBooking, setIsBooking] = useState(false); // Procesando reserva (Spinner)

  // 1. Cargar huecos disponibles cuando cambia la fecha
  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      setSlots([]);
      setSelectedSlot(null);
      
      const res = await getAvailableSlots(professionalId, selectedDate);
      
      if (res.success) {
        setSlots(res.slots);
      }
      setLoading(false);
    };

    if (selectedDate) fetchSlots();
  }, [selectedDate, professionalId]);

  // 2. Manejar la reserva real en Base de Datos
  const handleBooking = async () => {
    if (!selectedSlot) return;
    setIsBooking(true);

    const result = await requestAppointment(
      professionalId, 
      selectedDate, 
      selectedSlot, 
      serviceId
    );

    if (result.success) {
      // Éxito: Redirigir al panel del paciente
      router.push('/panel/paciente?new_appointment=true');
    } else {
      // Error
      if (result.errorCode === 'UNAUTHENTICATED') {
        // Si no está logueado, lo mandamos al login y luego lo devolvemos aquí
        const callbackUrl = encodeURIComponent(`/agendar/${professionalId}`);
        router.push(`/ingresar?callbackUrl=${callbackUrl}`);
      } else {
        alert("❌ " + result.error);
        // Si el horario se ocupó mientras elegía, refrescamos
        if (result.error && result.error.includes('ocupado')) {
           setSelectedSlot(null);
           // Podríamos recargar los slots aquí si quisiéramos
        }
      }
    }
    setIsBooking(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      
      {/* Cabecera del Servicio */}
      <div className="bg-gray-900 p-6 text-white">
        <h3 className="text-lg font-semibold opacity-90">Agendar Cita</h3>
        <div className="flex justify-between items-end mt-2">
            <div>
                <p className="font-bold text-2xl">{serviceTitle}</p>
                <p className="text-sm opacity-70">Duración: 60 min</p>
            </div>
            <div className="text-right">
                <span className="block text-xl font-bold">${servicePrice}</span>
            </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        
        {/* PASO 1: Selector de Fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            1. Selecciona el día
          </label>
          <input 
            type="date" 
            value={selectedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          <p className="text-xs text-gray-500 mt-2 capitalize">
            {selectedDate && format(new Date(selectedDate + 'T00:00:00'), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>

        {/* PASO 2: Grilla de Horarios */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            2. Horarios Disponibles
          </label>
          
          {loading ? (
            <div className="py-8 text-center text-gray-400 animate-pulse flex flex-col items-center">
              <span className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mb-2"></span>
              Buscando espacios libres...
            </div>
          ) : slots.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {slots.map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedSlot(time)}
                  className={`py-2 px-1 rounded-lg text-sm font-medium transition-all border ${
                    selectedSlot === time
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500 text-sm">No hay horarios disponibles.</p>
              <p className="text-xs text-gray-400 mt-1">Prueba seleccionando otro día.</p>
            </div>
          )}
        </div>

        {/* PASO 3: Botón de Acción */}
        <div className="pt-4 border-t border-gray-100">
          <button
            disabled={!selectedSlot || isBooking}
            onClick={handleBooking}
            className="w-full py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-900/20 flex justify-center items-center gap-2"
          >
            {isBooking ? (
               <>
                 <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                 Procesando...
               </>
            ) : selectedSlot ? (
               `Solicitar Reserva (${selectedSlot})`
            ) : (
               'Selecciona un horario'
            )}
          </button>
          
          {selectedSlot && (
            <p className="text-center text-xs text-gray-500 mt-3 animate-fadeIn">
              * La cita quedará pendiente de confirmación por el profesional.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}