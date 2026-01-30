// src/app/agendar/[id]/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useParams, useRouter } from 'next/navigation';

export default function AgendarPage() {
  const params = useParams();
  const router = useRouter();
  const professionalId = params.id;

  // Estados
  const [proData, setProData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedService, setSelectedService] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [busySlots, setBusySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // 1. Cargar datos del profesional y su disponibilidad ocupada
  const fetchData = useCallback(async () => {
    if (!professionalId) return;
    setLoading(true);
    try {
      // Endpoint que definimos antes para traer servicios y citas ocupadas
      const response = await fetch(`/api/calendar/${professionalId}`);
      if (response.ok) {
        const data = await response.json();
        // Asumiendo que el endpoint devuelve { busy: [...], services: [...] }
        setBusySlots(data.busy.map(slot => ({ start: new Date(slot.start) })));
        setProData(data.professional); 
      }
    } catch (error) {
      setMessage({ text: 'Error al cargar datos del profesional', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [professionalId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 2. Generar horarios disponibles filtrando colisiones
  useEffect(() => {
    if (!selectedDay) return;

    const slots = [];
    // Rango de 9 AM a 5 PM
    for (let hour = 9; hour < 17; hour++) {
      slots.push(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), hour));
    }

    const filtered = slots.filter(timeSlot => {
      return !busySlots.some(busy => busy.start.getTime() === timeSlot.getTime());
    });

    setAvailableTimes(filtered);
  }, [selectedDay, busySlots]);

  // 3. Función de envío compatible con tu API (FormData)
  const handleBooking = async (time) => {
    if (!selectedService) {
      alert("Por favor, selecciona primero un servicio.");
      return;
    }

    const confirmMsg = `¿Confirmas la cita para el ${format(time, "PPPP 'a las' p", { locale: es })}?`;
    if (!confirm(confirmMsg)) return;

    setSubmitting(true);
    setMessage({ text: '', type: '' });

    try {
      // Creamos el FormData que requiere tu endpoint
      const formData = new FormData();
      formData.append('startTime', time.toISOString());
      formData.append('serviceId', selectedService);

      const response = await fetch(`/api/calendar/${professionalId}/book`, {
        method: 'POST',
        body: formData, // Enviamos FormData directamente
      });

      // Tu API redirige en caso de éxito o error 302/303
      if (response.redirected) {
        window.location.href = response.url;
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setMessage({ text: '¡Cita agendada! Redirigiendo...', type: 'success' });
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        setMessage({ text: data.message || 'Error al agendar', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Error de red al intentar agendar.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-12 max-w-5xl min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8">Finalizar Reserva</h1>

      {message.text && (
        <div className={`p-4 mb-6 rounded-lg text-center ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* PASO 1: SERVICIO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
            Selecciona Servicio
          </h2>
          <div className="space-y-3">
            {proData?.services?.map(s => (
              <label key={s.id} className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedService === s.id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <input 
                  type="radio" 
                  name="service" 
                  className="hidden" 
                  value={s.id} 
                  onChange={(e) => setSelectedService(e.target.value)} 
                />
                <div className="flex justify-between w-full items-center">
                  <span className="font-medium text-gray-800">{s.title}</span>
                  <span className="text-blue-600 font-bold text-sm">${Number(s.price)}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* PASO 2: CALENDARIO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col items-center">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 self-start">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
            Día de la cita
          </h2>
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            disabled={{ before: new Date() }}
            locale={es}
          />
        </div>

        {/* PASO 3: HORARIOS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
            Hora disponible
          </h2>
          {selectedDay ? (
            <div className="grid grid-cols-2 gap-2">
              {availableTimes.length > 0 ? (
                availableTimes.map((time, i) => (
                  <button
                    key={i}
                    disabled={submitting}
                    onClick={() => handleBooking(time)}
                    className="py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {format(time, 'p', { locale: es })}
                  </button>
                ))
              ) : (
                <p className="text-gray-400 italic text-sm py-4">No hay turnos para este día.</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 border-2 border-dashed border-gray-100 rounded-xl text-gray-400 text-sm text-center px-4">
              Selecciona un día para ver los horarios
            </div>
          )}
        </div>
      </div>
    </div>
  );
}