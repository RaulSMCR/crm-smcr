// src/app/registro/profesional/page.js
'use client'

import { useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { registerProfessional } from '@/actions/auth-actions';
import Link from 'next/link';

export default function RegistroProfesionalPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estado para validación visual inmediata
  const [passError, setPassError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPassError(false);

    const formData = new FormData(e.target);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const fileInput = e.target.querySelector('input[type="file"]');
    const file = fileInput?.files[0];

    // --- 1. VALIDACIONES DE SEGURIDAD (CLIENTE) ---
    
    if (password !== confirmPassword) {
      setError('❌ Las contraseñas no coinciden.');
      setPassError(true);
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('⚠️ La contraseña debe tener al menos 8 caracteres.');
      setPassError(true);
      setLoading(false);
      return;
    }

    if (!file) {
      setError('⚠️ Es obligatorio adjuntar tu Curriculum Vitae (PDF).');
      setLoading(false);
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB Limit
      setError('⚠️ El archivo PDF es demasiado pesado (Máx 2MB).');
      setLoading(false);
      return;
    }

    try {
      // --- 2. SUBIDA DE ARCHIVO A SUPABASE ---
      
      // Nombre único: timestamp-nombreusuario-clean.pdf
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '');
      const uniqueName = `${Date.now()}-${cleanFileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('cvs')
        .upload(uniqueName, file);

      if (uploadError) throw new Error('Error al subir el CV: ' + uploadError.message);

      // Obtener URL Pública
      const { data: { publicUrl } } = supabase
        .storage
        .from('cvs')
        .getPublicUrl(uniqueName);

      // --- 3. REGISTRO EN SERVIDOR (SERVER ACTION) ---
      
      // Inyectamos la URL del CV en el formData que va al servidor
      formData.append('cvUrl', publicUrl); 

      const result = await registerProfessional(formData);

      if (result?.error) {
        throw new Error(result.error);
      }

      // --- 4. ÉXITO ---
      // Redirigir a página de confirmación o login
      window.location.href = '/ingresar?registered=true';

    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.');
      
      // Si falló el registro pero se subió el archivo, idealmente limpiaríamos el archivo,
      // pero por ahora lo prioritario es mostrar el error al usuario.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg">
          🩺
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Únete como Profesional
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Forma parte de la red de salud mental más grande de Costa Rica.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0 text-red-500">⚠️</div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* --- DATOS PERSONALES --- */}
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                <div className="mt-1">
                  <input name="name" type="text" required 
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                <div className="mt-1">
                  <input name="email" type="email" required 
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                <div className="mt-1">
                  <input name="password" type="password" required minLength={8}
                    className={`appearance-none block w-full px-3 py-2 border ${passError ? 'border-red-300 bg-red-50' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Confirmar Contraseña</label>
                <div className="mt-1">
                  <input name="confirmPassword" type="password" required minLength={8}
                    className={`appearance-none block w-full px-3 py-2 border ${passError ? 'border-red-300 bg-red-50' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  />
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-2 bg-white text-sm text-gray-500 font-medium">Información Profesional</span>
              </div>
            </div>

            {/* --- DATOS PROFESIONALES --- */}
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Especialidad</label>
                <input name="specialty" type="text" placeholder="Ej: Psicología Clínica" required 
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Nº Matrícula / Licencia</label>
                <input name="licenseNumber" type="text" placeholder="Ej: CPP-4050" required 
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Teléfono Profesional</label>
                <input name="phone" type="tel" placeholder="+506 ..." required 
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Breve Biografía</label>
                <textarea name="bio" rows={3} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Cuéntanos un poco sobre tu experiencia y enfoque..."></textarea>
              </div>
            </div>

            {/* --- SUBIDA DE CV --- */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <label className="block text-sm font-bold text-blue-800 mb-2">
                Adjuntar Curriculum Vitae (PDF) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center justify-center px-6 pt-5 pb-6 border-2 border-blue-300 border-dashed rounded-md bg-white hover:bg-blue-50 transition-colors">
                <div className="space-y-1 text-center">
                  <svg className="mx-auto h-12 w-12 text-blue-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label htmlFor="cvFile" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                      <span>Subir un archivo</span>
                      <input id="cvFile" name="cvFile" type="file" accept=".pdf" className="sr-only" required />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">PDF hasta 2MB</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-blue-700">
                🔒 Este documento será revisado por la administración para validar tu perfil.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando Registro...
                  </span>
                ) : (
                  'Registrarse'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  ¿Ya tienes una cuenta?
                </span>
              </div>
            </div>
            <div className="mt-6 text-center">
              <Link href="/ingresar" className="font-medium text-blue-600 hover:text-blue-500">
                Iniciar Sesión
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}