// src/components/AdminApproveButton.js
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminApproveButton({
  label = 'Aprobar',
  endpoint,
  method = 'POST',
  className = '',
  pendingLabel = 'Procesando...',
  buttonClassName = 'bg-green-600 hover:bg-green-700',
  confirmMessage = '',
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  async function onApprove() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

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
        className={`px-3 py-2 rounded text-white text-sm disabled:opacity-70 ${buttonClassName}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
