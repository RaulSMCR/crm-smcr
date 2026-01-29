'use client'

import { useState, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/actions/reset-password-actions';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState({ type: '', message: '' });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded shadow text-center">
          <h1 className="text-xl font-bold text-red-600">Enlace inválido</h1>
          <p className="text-gray-600 mt-2">No se encontró el token de seguridad.</p>
          <Link href="/auth/forgot-password" className="mt-4 inline-block text-blue-600 hover:underline">
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (passwords.new !== passwords.confirm) {
      setStatus({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }
    
    if (passwords.new.length < 6) {
      setStatus({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    setStatus({ type: '', message: '' });

    startTransition(async () => {
      const res = await resetPassword(token, passwords.new);
      if (res.error) {
        setStatus({ type: 'error', message: res.error });
      } else {
        setStatus({ type: 'success', message: 'Contraseña actualizada con éxito.' });
        // Redirigir al login después de 2 segundos
        setTimeout(() => router.push('/login'), 2000);
      }
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Nueva Contraseña</h1>
          <p className="text-gray-600 mt-2 text-sm">Crea una nueva contraseña segura para tu cuenta.</p>
        </div>

        {status.message && (
          <div className={`p-4 mb-4 rounded text-sm ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {status.message}
          </div>
        )}

        {status.type !== 'success' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
              <input
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmar contraseña</label>
              <input
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isPending ? 'Actualizando...' : 'Cambiar Contraseña'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}