// src/components/AdminApproveButton.js
'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Toast from '@/components/ui/Toast';

export default function AdminApproveButton({
  label = 'Aprobar',
  endpoint,
  method = 'POST',
  className = '',
  pendingLabel = 'Procesando...',
  buttonClassName = 'bg-green-600 hover:bg-green-700',
  confirmMessage = '',
  successMessage = '',
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);

  async function onApprove() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setToast(null);
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
      setToast({ message: successMessage || `${label} realizado correctamente.`, type: 'success' });
      startTransition(() => router.refresh());
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
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
      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </div>
  );
}
