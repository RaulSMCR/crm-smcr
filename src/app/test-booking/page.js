'use client'

import { useState } from 'react';
import BookingWidget from '@/components/booking-widget';

export default function TestBookingPage() {
  const [selection, setSelection] = useState(null);

  // Pon aquí el ID de un profesional que TENGAS en tu base de datos y tenga horarios
  // Puedes copiarlo desde tu base de datos (tabla Professional)
  const TEST_PROFESSIONAL_ID = "REEMPLAZA_CON_UN_ID_REAL_DE_TU_DB"; 

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Prueba de Motor de Reservas</h1>
      
      {/* Widget */}
      <BookingWidget 
        professionalId={TEST_PROFESSIONAL_ID} 
        onSlotSelect={(data) => setSelection(data)}
      />

      {/* Debugger Visual */}
      <div className="mt-10 p-4 bg-slate-100 rounded border font-mono text-sm">
        <h3 className="font-bold mb-2">Estado de Selección (Output):</h3>
        <pre>{JSON.stringify(selection, null, 2)}</pre>
      </div>

      {selection && (
        <button className="mt-4 bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-bold w-full md:w-auto">
          Confirmar Cita para {selection.time}
        </button>
      )}
    </main>
  );
}