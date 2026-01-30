'use client'

import { useState, useEffect, useTransition } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';
import { fetchSlots } from '@/actions/booking-actions';
import 'react-day-picker/dist/style.css'; // Estilos base del calendario

export default function BookingWidget({ professionalId, onSlotSelect }) {
  const [date, setDate] = useState();
  const [slots, setSlots] = useState([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Efecto: Cuando cambia la fecha, buscar slots
  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }

    // Resetear selección previa
    setSelectedSlot(null);
    onSlotSelect(null); // Avisar al padre que se limpió selección

    startTransition(async () => {
      setError(null);
      // Enviamos la fecha como ISO string
      const result = await fetchSlots(professionalId, date.toISOString());
      
      if (result.error) {
        setError(result.error);
        setSlots([]);
      } else {
        setSlots(result.slots || []);
      }
    });
  }, [date, professionalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    // Devolvemos al componente padre el objeto completo { date, time, iso }
    if (onSlotSelect) {
      onSlotSelect({
        date: date,
        time: slot.time,
        iso: slot.iso
      });
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start">
      
      {/* 1. CALENDARIO */}
      <div className="bg-white p-4 rounded-lg border shadow-sm mx-auto md:mx-0">
        <DayPicker
          mode="single"
          selected={date}
          onSelect={setDate}
          locale={es}
          disabled={{ before: new Date() }} // No permitir fechas pasadas
          modifiersClassNames={{
            selected: 'bg-blue-600 text-white rounded-full hover:bg-blue-700'
          }}
          styles={{
            head_cell: { width: '40px' },
            table: { maxWidth: 'none' },
            day: { margin: 'auto' }
          }}
        />
        <p className="text-center text-sm text-gray-500 mt-2">
          {date ? format(date, "EEEE d 'de' MMMM", { locale: es }) : "Selecciona una fecha"}
        </p>
      </div>

      {/* 2. SELECTOR DE HORAS */}
      <div className="flex-1 w-full">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          Horarios Disponibles
        </h3>

        {!date && (
          <div className="text-gray-500 italic p-4 border border-dashed rounded bg-gray-50 text-center">
            Selecciona un día en el calendario para ver disponibilidad.
          </div>
        )}

        {isPending && (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {date && !isPending && slots.length === 0 && !error && (
          <div className="text-amber-600 bg-amber-50 p-4 rounded border border-amber-200">
            No hay turnos disponibles para este día.
          </div>
        )}

        {error && (
          <div className="text-red-600 bg-red-50 p-4 rounded border border-red-200">
            {error}
          </div>
        )}

        {/* GRILLA DE SLOTS */}
        {!isPending && slots.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {slots.map((slot) => (
              <button
                key={slot.iso}
                onClick={() => handleSlotClick(slot)}
                className={`py-2 px-3 rounded text-sm font-medium transition-all border ${
                  selectedSlot?.iso === slot.iso
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {slot.time}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
