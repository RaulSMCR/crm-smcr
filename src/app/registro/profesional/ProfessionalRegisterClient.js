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
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 space-y-8">
      
      {/* Encabezado */}
      <div className="text-center pb-6 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900">Solicitud de Ingreso Profesional</h2>
        <p className="text-sm text-gray-500 mt-2">Completa tu perfil para unirte a la red de Salud Mental Costa Rica.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200 font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* SECCIÓN 1: Credenciales */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
          1. Datos de la Cuenta
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre Completo *</label>
            <input name="name" type="text" required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Ej: Dr. Juan Pérez" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Especialidad *</label>
            <input name="specialty" type="text" required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Ej: Psicólogo Clínico" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Correo Electrónico *</label>
            <input name="email" type="email" required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="correo@ejemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña *</label>
            <input name="password" type="password" required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="••••••••" />
          </div>
        </div>
      </section>

      {/* SECCIÓN 2: Perfil Público */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
          2. Perfil Público
        </h3>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono / WhatsApp</label>
          <input name="phone" type="tel" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="+506 8888-8888" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Biografía Corta</label>
          <textarea name="bio" rows="3" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Descríbete brevemente para los pacientes..."></textarea>
        </div>
      </section>

      {/* SECCIÓN 3: Admisión */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
          3. Documentación de Admisión
        </h3>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Carta de Presentación</label>
          <textarea name="coverLetter" rows="4" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="¿Por qué deseas unirte a nuestra plataforma?"></textarea>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Adjuntar CV (PDF/Word)</label>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                    </svg>
                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Haz clic para subir</span> o arrastra el archivo</p>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX (Máx. 5MB)</p>
                </div>
                <input name="cv" type="file" className="hidden" accept=".pdf,.doc,.docx" />
            </label>
          </div> 
        </div>
      </section>

      <div className="pt-4">
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-900 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-800 transition transform active:scale-[0.99] disabled:opacity-70 shadow-lg"
        >
          {loading ? 'Procesando Registro...' : 'Enviar Solicitud Profesional'}
        </button>
      </div>

      <p className="text-xs text-center text-gray-400 mt-4">
        Al registrarte, aceptas nuestros términos y condiciones y la política de privacidad de datos.
      </p>
    </form>
  );
}