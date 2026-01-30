//src/app/profesionales/[id]/page.js
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

  const [selectedDay, setSelectedDay] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [busySlots, setBusySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  const fetchAvailability = useCallback(async () => {
    if (!professionalId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/calendar/${professionalId}`);
      if (response.ok) {
        const data = await response.json();
        const busyDates = data.busy.map(slot => ({
          start: new Date(slot.start),
          end: new Date(slot.end),
        }));
        setBusySlots(busyDates);
      }
    } catch (error) {
      console.error("Error al cargar disponibilidad:", error);
    } finally {
      setLoading(false);
    }
  }, [professionalId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  useEffect(() => {
    if (!selectedDay) {
      setAvailableTimes([]);
      return;
    }

    // Generar slots de 9 AM a 5 PM (Mejorable leyendo pro.availabilities)
    const workHours = [];
    for (let hour = 9; hour < 17; hour++) {
      workHours.push(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), hour));
    }

    const available = workHours.filter(timeSlot => {
      return !busySlots.some(busySlot => 
        timeSlot.getTime() === busySlot.start.getTime()
      );
    });

    setAvailableTimes(available);
  }, [selectedDay, busySlots]);

  const handleTimeSelect = async (time) => {
    setMessage({ text: '', type: '' });
    const isConfirmed = confirm(`¿Confirmas la cita para el ${format(time, "PPPP 'a las' p", { locale: es })}?`);

    if (isConfirmed) {
      try {
        const response = await fetch(`/api/calendar/${professionalId}/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedTime: time }),
        });

        const data = await response.json();

        if (response.ok) {
          setMessage({ text: '¡Cita agendada con éxito! Revisa tu correo.', type: 'success' });
          fetchAvailability();
          setSelectedDay(null);
        } else {
          setMessage({ text: `Error: ${data.error || 'No se pudo agendar.'}`, type: 'error' });
        }
      } catch (error) {
        setMessage({ text: 'Error de conexión al servidor.', type: 'error' });
      }
    }
  };

  return (
    <div className="container mx-auto px-6 py-12 max-w-5xl">
      <h1 className="text-3xl font-bold text-center mb-2">Agenda tu Cita</h1>
      <p className="text-center text-gray-600 mb-8">Gestión profesional de turnos SMCR</p>

      {message.text && (
        <div className={`p-4 mb-6 rounded-xl text-center font-medium ${message.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex justify-center">
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            disabled={{ before: new Date() }}
            locale={es}
          />
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">
            {selectedDay ? format(selectedDay, 'PPP', { locale: es }) : 'Selecciona un día'}
          </h2>
          
          {loading ? (
            <p className="text-gray-400 animate-pulse">Consultando agenda...</p>
          ) : selectedDay ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {availableTimes.length > 0 ? (
                availableTimes.map((time, index) => (
                  <button 
                    key={index}
                    onClick={() => handleTimeSelect(time)}
                    className="bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-sm"
                  >
                    {format(time, 'p', { locale: es })}
                  </button>
                ))
              ) : (
                <p className="col-span-full text-gray-500 italic">No hay horarios disponibles.</p>
              )}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-xl text-gray-300">
              Esperando selección de fecha
            </div>
          )}
        </div>
      </div>
    </div>
  );
}