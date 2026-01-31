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
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 space-y-6">
      
      <div className="text-center pb-4 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900">Solicitud de Ingreso Profesional</h2>
        <p className="text-sm text-gray-500 mt-1">Completa tu perfil para unirte a la red.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* SECCIÓN 1: Credenciales Básicas */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">1. Datos de Cuenta</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
            <input name="name" type="text" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Dr. Juan Pérez" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad *</label>
            <input name="specialty" type="text" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Psicología, Nutrición..." />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input name="email" type="email" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="correo@ejemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
            <input name="password" type="password" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: Perfil Profesional */}
      <div className="space-y-4 pt-4 border-t border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">2. Perfil Profesional</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono / WhatsApp</label>
          <input name="phone" type="tel" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+54 9 11..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Biografía Corta</label>
          <textarea name="bio" rows="2" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Breve descripción para tu perfil público..."></textarea>
        </div>
      </div>

      {/* SECCIÓN 3: Documentación */}
      <div className="space-y-4 pt-4 border-t border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">3. Documentación</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Carta de Presentación</label>
          <textarea name="coverLetter" rows="4" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Cuéntanos por qué quieres unirte y cuál es tu experiencia..."></textarea>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Adjuntar CV (PDF o Word)</label>
          <input 
            name="cv" 
            type="file" 
            accept=".pdf,.doc,.docx"
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
          />
          <p className="text-xs text-gray-400 mt-1">Máximo 5MB.</p>
        </div>
      </div>

      <div className="pt-4">
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-gray-900 text-white py-3.5 rounded-lg font-bold hover:bg-black transition-all disabled:opacity-50 shadow-lg shadow-gray-900/10"
        >
          {loading ? 'Procesando...' : 'Enviar Solicitud'}
        </button>
      </div>
    </form>
  );
}