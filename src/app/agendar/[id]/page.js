// src/app/agendar/[id]/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useParams, useRouter } from 'next/navigation';

// IMPORTAMOS LAS ACTIONS (El backend directo)
import { obtenerDatosAgenda, agendarCita } from '@/actions/agenda-actions';

export default function AgendarPage() {
  const params = useParams();
  const router = useRouter();
  const professionalId = Number(params.id); // Asegurar que sea número

  // Estados
  const [proData, setProData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedService, setSelectedService] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [busySlots, setBusySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // 1. CARGA DE DATOS (MODO MODERNO)
  const loadData = useCallback(async () => {
    if (!professionalId) return;
    setLoading(true);

    // Llamada directa a la Server Action (Sin fetch)
    const data = await obtenerDatosAgenda(professionalId);

    if (data.success) {
      setProData(data.professional);
      // Mapeamos las fechas igual que antes
      setBusySlots(data.busy.map(slot => ({ start: new Date(slot.start) })));
    } else {
      setMessage({ text: data.error || 'Error al cargar datos', type: 'error' });
    }
    setLoading(false);
  }, [professionalId]);

  useEffect(() => { loadData(); }, [loadData]);

  // 2. LOGICA DE HORARIOS (Se mantiene igual por ahora)
  useEffect(() => {
    if (!selectedDay) return;
    const slots = [];
    // Rango hardcoded 9 a 17 (Idealmente esto debería venir del server también en el futuro)
    for (let hour = 9; hour < 17; hour++) {
      slots.push(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), hour));
    }
    const filtered = slots.filter(timeSlot => {
      return !busySlots.some(busy => busy.start.getTime() === timeSlot.getTime());
    });
    setAvailableTimes(filtered);
  }, [selectedDay, busySlots]);

  // 3. ENVÍO DE FORMULARIO (MODO MODERNO)
  const handleBooking = async (time) => {
    if (!selectedService) return alert("Selecciona un servicio.");
    
    const confirmMsg = `¿Confirmas la cita para el ${format(time, "PPPP 'a las' p", { locale: es })}?`;
    if (!confirm(confirmMsg)) return;

    setSubmitting(true);
    setMessage({ text: '', type: '' });

    // Preparamos los datos
    const formData = new FormData();
    formData.append('startTime', time.toISOString());
    formData.append('serviceId', selectedService);

    // Llamada directa a la Server Action
    const response = await agendarCita(formData, professionalId);

    if (response.success) {
      setMessage({ text: '¡Cita agendada! Redirigiendo...', type: 'success' });
      // Redirección manual segura
      setTimeout(() => router.push('/panel/paciente/citas'), 1500);
    } else {
      setMessage({ text: response.error || 'Error al agendar', type: 'error' });
    }
    setSubmitting(false);
  };

  // --- RENDER (Sin cambios visuales) ---
  return (
    <div className="container mx-auto px-6 py-12 max-w-5xl min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8">Finalizar Reserva</h1>

      {loading && <p className="text-center text-gray-500">Cargando agenda...</p>}

      {message.text && (
        <div className={`p-4 mb-6 rounded-lg text-center ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {message.text}
        </div>
      )}

      {!loading && proData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ... (EL RESTO DEL HTML SE MANTIENE EXACTAMENTE IGUAL) ... */}
            {/* Solo asegúrate de cerrar bien los tags y componentes */}
            
            {/* PASO 1: SERVICIO */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
             {/* ... código del selector de servicios ... */}
             <div className="space-y-3">
               {proData.services?.map(s => (
                 <label key={s.id} className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedService === s.id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                   <input type="radio" name="service" className="hidden" value={s.id} onChange={(e) => setSelectedService(e.target.value)} />
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
               <DayPicker mode="single" selected={selectedDay} onSelect={setSelectedDay} disabled={{ before: new Date() }} locale={es} />
            </div>

            {/* PASO 3: HORARIOS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
               {/* ... lógica de botones de hora ... */}
               {selectedDay ? (
                <div className="grid grid-cols-2 gap-2">
                  {availableTimes.length > 0 ? (
                    availableTimes.map((time, i) => (
                      <button key={i} disabled={submitting} onClick={() => handleBooking(time)} className="py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50">
                        {format(time, 'p', { locale: es })}
                      </button>
                    ))
                  ) : (
                    <p className="text-gray-400 italic text-sm py-4">No hay turnos.</p>
                  )}
                </div>
               ) : (
                 <div className="flex items-center justify-center h-48 border-2 border-dashed border-gray-100 rounded-xl text-gray-400 text-sm px-4 text-center">Selecciona un día.</div>
               )}
            </div>
        </div>
      )}
    </div>
  );
}