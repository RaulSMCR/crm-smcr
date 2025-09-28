// src/components/AdminApproveButton.js
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminApproveButton({
  label = 'Aprobar',
  endpoint, // ej: `/api/admin/posts/123/approve` ó `/api/admin/professionals/45/approve`
  method = 'POST',
  className = '',
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  async function onApprove() {
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || `Error ${res.status}`);
      }
      // refrescamos la página para que desaparezca el ítem aprobado
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <button
        onClick={onApprove}
        disabled={pending}
        className="px-3 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-70"
      >
        {pending ? 'Aprobando…' : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
