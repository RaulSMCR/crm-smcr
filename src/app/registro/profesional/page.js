// src/app/registro/profesional/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerProfessional } from '@/actions/auth-actions'; // Importamos la acción

export default function ProfessionalRegisterClient() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.target);
    const res = await registerProfessional(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      // Éxito
      router.push('/ingresar?registered=true');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
        <input name="name" type="text" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Especialidad</label>
        <input 
          name="specialty" // <--- OJO: Debe llamarse "specialty"
          type="text" 
          placeholder="Ej: Psicólogo Clínico, Nutricionista..." 
          required 
          className="mt-1 block w-full border border-gray-300 rounded-md p-2" 
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
        <input name="email" type="email" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Contraseña</label>
        <input name="password" type="password" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Registrando...' : 'Crear Cuenta Profesional'}
      </button>
    </form>
  );
}