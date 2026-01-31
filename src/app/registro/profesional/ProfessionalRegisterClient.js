//src/registro/profesional/ProfessionalRegisterClient.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// IMPORTANTE: Importamos la Server Action, no usamos fetch
import { registerProfessional } from '@/actions/auth-actions'; 

export default function ProfessionalRegisterClient() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.target);
    
    // Llamada directa a la Server Action (esto se ejecuta en el servidor)
    const res = await registerProfessional(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      // Éxito: Redirigir al login
      router.push('/ingresar?registered=true');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      
      <h2 className="text-xl font-bold text-gray-800 mb-4">Registro Profesional</h2>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">
          ⚠️ {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
        <input name="name" type="text" required placeholder="Ej: Dr. Juan Pérez" className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Especialidad</label>
        {/* OJO: El name debe ser "specialty" para coincidir con la base de datos */}
        <input name="specialty" type="text" required placeholder="Ej: Psicólogo Clínico" className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
        <input name="email" type="email" required placeholder="nombre@ejemplo.com" className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Contraseña</label>
        <input name="password" type="password" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Creando cuenta...' : 'Registrarme'}
      </button>

      <p className="text-xs text-center text-gray-500 mt-4">
        Al registrarte aceptas nuestros términos y condiciones.
      </p>
    </form>
  );
}