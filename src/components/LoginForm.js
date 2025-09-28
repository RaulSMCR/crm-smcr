// src/components/LoginForm.js
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');

    if (!email || !password) {
      setError('Ingresá email y contraseña.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);

      // Redirección por rol
      let to = '/';
      if (data.role === 'ADMIN') to = '/admin';
      else if (data.role === 'PROFESSIONAL') to = '/dashboard-profesional';
      else to = '/cuenta';

      startTransition(() => {
        router.push(to);
        router.refresh();
      });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm w-full space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          name="email"
          className="w-full border rounded px-3 py-2"
          placeholder="tu@email.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <input
          type="password"
          name="password"
          className="w-full border rounded px-3 py-2"
          placeholder="••••••••"
          required
        />
      </div>

      {error ? (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70"
      >
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  );
}
