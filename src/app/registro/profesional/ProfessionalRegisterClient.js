//src/registro/profesional/ProfessionalRegisterClient.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
    const res = await registerProfessional(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push('/ingresar?registered=true');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
      
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Registro Profesional</h2>
        <p className="text-sm text-gray-500">Únete a nuestra red de especialistas</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      {/* Grid para Nombre y Especialidad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre Completo *</label>
          <input name="name" type="text" required placeholder="Ej: Dr. Juan Pérez" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Especialidad *</label>
          <input name="specialty" type="text" required placeholder="Ej: Psicólogo Clínico" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition" />
        </div>
      </div>

      {/* Teléfono */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono / WhatsApp</label>
        <input name="phone" type="tel" placeholder="+54 11 ..." className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition" />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Correo Electrónico *</label>
        <input name="email" type="email" required placeholder="nombre@ejemplo.com" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition" />
      </div>

      {/* Contraseña */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña *</label>
        <input name="password" type="password" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition" />
        <p className="text-xs text-gray-400 mt-1">Mínimo 6 caracteres.</p>
      </div>

      {/* Biografía */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Biografía / Presentación</label>
        <textarea 
          name="bio" 
          rows="3" 
          placeholder="Cuenta brevemente sobre tu experiencia y enfoque..." 
          className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition"
        ></textarea>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3.5 rounded-lg font-bold text-lg hover:bg-blue-700 transition transform active:scale-[0.99] disabled:opacity-50 shadow-md hover:shadow-lg"
      >
        {loading ? 'Creando cuenta...' : 'Registrarme como Profesional'}
      </button>

      <p className="text-xs text-center text-gray-500 mt-4">
        Al hacer clic en registrarme, aceptas los términos de uso y política de privacidad.
      </p>
    </form>
  );
}