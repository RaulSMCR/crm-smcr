// src/components/CancelAppointmentButton.js
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function CancelAppointmentButton({ professionalId, appointmentId, className = '' }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState(null);

  async function onCancel() {
    setErr(null);
    try {
      const res = await fetch(`/api/calendar/${professionalId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || `Error ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <button
        onClick={onCancel}
        disabled={pending}
        className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-70"
        title="Cancelar cita"
      >
        {pending ? 'Cancelando…' : 'Cancelar'}
      </button>
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
    </div>
  );
}
