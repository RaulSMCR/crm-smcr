'use client'

import { useState, useTransition } from 'react';
import BookingWidget from '@/components/booking-widget';
import { createAppointment } from '@/actions/appointment-actions';
import Link from 'next/link';

export default function TestBookingPage() {
  const [selection, setSelection] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState(null);

  // --- IMPORTANTE: CAMBIA ESTO POR UN ID REAL DE TU DB LUEGO DE CREAR AL PROFESIONAL ---
  // Lo dejaremos vacío por ahora para que veas dónde ponerlo
  const TEST_PROFESSIONAL_ID = "PON_AQUI_EL_ID_DEL_PROFESIONAL"; 

  const handleConfirm = () => {
    if (!selection || !TEST_PROFESSIONAL_ID) return;

    startTransition(async () => {
      const response = await createAppointment(TEST_PROFESSIONAL_ID, selection.iso);
      setResult(response);
    });
  };

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Prueba de Sistema de Reservas</h1>
      
      {!TEST_PROFESSIONAL_ID || TEST_PROFESSIONAL_ID === "PON_AQUI_EL_ID_DEL_PROFESIONAL" ? (
        <div className="bg-amber-100 text-amber-800 p-4 rounded mb-6">
          ⚠️ <strong>Atención:</strong> Debes editar <code>src/app/test-booking/page.js</code> y poner el ID del profesional que crearemos en el paso 1.
        </div>
      ) : (
        <>
          <BookingWidget 
            professionalId={TEST_PROFESSIONAL_ID} 
            onSlotSelect={(data) => {
              setSelection(data);
              setResult(null); // Limpiar mensajes previos
            }}
          />

          {selection && !result && (
            <div className="mt-8 p-6 bg-slate-50 border rounded-lg text-center">
              <p className="text-lg mb-4">
                ¿Confirmar reserva para el <strong>{selection.date.toLocaleDateString()}</strong> a las <strong>{selection.time}</strong>?
              </p>
              <button 
                onClick={handleConfirm}
                disabled={isPending}
                className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-all"
              >
                {isPending ? 'Procesando...' : 'Confirmar Reserva Real'}
              </button>
            </div>
          )}

          {result && (
            <div className={`mt-6 p-4 rounded-lg text-center ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {result.success ? (
                <>
                  <p className="font-bold text-xl">✅ ¡Cita creada con éxito!</p>
                  <p className="text-sm mt-2">ID: {result.appointmentId}</p>
                  <p className="mt-4">Revisa el Dashboard del profesional para verla.</p>
                </>
              ) : (
                <p>❌ Error: {result.error}</p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}