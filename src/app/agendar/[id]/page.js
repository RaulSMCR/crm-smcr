// src/app/agendar/[id]/page.js
'use client';

import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { es } from 'date-fns/locale'; // Importar el localizador en español
import { useParams } from 'next/navigation';

export default function AgendarPage() {
  const params = useParams();
  const professionalId = params.id;

  const [selectedDay, setSelectedDay] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [busySlots, setBusySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Función para obtener los horarios ocupados del profesional
  const fetchAvailability = async () => {
    if (!professionalId) return;
    setLoading(true);
    const response = await fetch(`/api/calendar/${professionalId}`);
    if (response.ok) {
      const data = await response.json();
      const busyDates = data.busy.map(slot => ({
        start: new Date(slot.start),
        end: new Date(slot.end),
      }));
      setBusySlots(busyDates);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAvailability();
  }, [professionalId]);

  // Función para generar los horarios disponibles para el día seleccionado
  useEffect(() => {
    if (!selectedDay) {
      setAvailableTimes([]);
      return;
    }

    const workHours = [];
    for (let hour = 9; hour < 17; hour++) { // Horario de ejemplo: 9 AM a 5 PM
      workHours.push(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), hour));
    }

    const available = workHours.filter(timeSlot => {
      return !busySlots.some(busySlot => 
        timeSlot >= busySlot.start && timeSlot < busySlot.end
      );
    });

    setAvailableTimes(available);
  }, [selectedDay, busySlots]);

  // --- ESTA ES LA FUNCIÓN ACTUALIZADA Y FINAL ---
  // Se ejecuta al seleccionar una hora para agendar la cita
  const handleTimeSelect = async (time) => {
    setMessage('');
    const isConfirmed = confirm(`¿Confirmas que deseas agendar una cita para las ${format(time, 'p', { locale: es })}?`);

    if (isConfirmed) {
      try {
        const response = await fetch(`/api/calendar/${professionalId}/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedTime: time }),
        });

        if (response.ok) {
          setMessage('¡Cita agendada con éxito! Revisa tu correo para ver la invitación de Google Calendar.');
          // Recargar la disponibilidad para que el horario ya no aparezca
          fetchAvailability();
          setSelectedDay(null); // Reiniciar el calendario
        } else {
          const errorData = await response.json();
          setMessage(`Error: ${errorData.error || 'No se pudo agendar la cita.'}`);
        }
      } catch (error) {
        setMessage('Error de conexión al intentar agendar la cita.');
      }
    }
  };

  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-center mb-2">Agenda tu Cita</h1>
      <p className="text-center text-gray-600 mb-8">Selecciona un día y luego elige una hora disponible.</p>

      {message && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`} role="alert">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Columna del Calendario */}
        <div className="bg-white p-4 rounded-lg shadow-md">
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            disabled={{ before: new Date() }}
            locale={es} // Usar el idioma español para el calendario
          />
        </div>
        
        {/* Columna de Horarios Disponibles */}
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">
            {selectedDay ? `Horarios para ${format(selectedDay, 'PPP', { locale: es })}` : 'Selecciona un día'}
          </h2>
          {loading && <p>Cargando disponibilidad...</p>}
          {!loading && selectedDay && (
            <div className="grid grid-cols-3 gap-2">
              {availableTimes.length > 0 ? (
                availableTimes.map((time, index) => (
                  <button 
                    key={index}
                    onClick={() => handleTimeSelect(time)}
                    className="bg-brand-primary text-white p-2 rounded-md hover:bg-opacity-80 transition-colors"
                  >
                    {format(time, 'p', { locale: es })}
                  </button>
                ))
              ) : (
                <p>No hay horarios disponibles para este día.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}