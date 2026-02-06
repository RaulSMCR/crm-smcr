// src/app/registro/profesional/page.js
'use client'

import { useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { registerProfessional } from '@/actions/auth-actions'; // <--- Tu acción de registro

export default function RegistroProfesionalPage() {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  // Manejar la selección del archivo
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validación extra: Solo PDF y menos de 2MB
      if (selectedFile.type !== 'application/pdf') {
        alert('Solo se permiten archivos PDF');
        e.target.value = null;
        return;
      }
      if (selectedFile.size > 2 * 1024 * 1024) { // 2MB
        alert('El archivo es muy pesado (Máx 2MB)');
        e.target.value = null;
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.target);
    
    // 1. VALIDACIÓN: ¿Hay archivo?
    if (!file) {
      setError('⚠️ Es obligatorio adjuntar tu Curriculum Vitae (PDF).');
      setLoading(false);
      return;
    }

    try {
      // 2. SUBIDA: Subir archivo a Supabase Storage
      const fileExt = file.name.split('.').pop();
      // Creamos un nombre único para evitar colisiones: fecha-nombre
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('cvs') // <--- Nombre de tu bucket
        .upload(fileName, file);

      if (uploadError) throw new Error('Error subiendo el CV: ' + uploadError.message);

      // 3. OBTENER URL: Conseguir la URL pública
      const { data: { publicUrl } } = supabase
        .storage
        .from('cvs')
        .getPublicUrl(fileName);

      // 4. REGISTRO: Añadir la URL al formData y enviar al servidor
      formData.append('cvUrl', publicUrl); // <--- Aquí inyectamos la URL

      // Llamamos a tu Server Action existente
      const result = await registerProfessional(formData);

      if (result?.error) {
        throw new Error(result.error);
      }

      // Éxito: Redirigir a "Espera Aprobación" o Login
      window.location.href = '/espera-aprobacion'; // O la ruta que prefieras

    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Registro Profesional
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Únete a nuestra red de especialistas.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center">
              {error}
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            {/* Campos Normales */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
              <input name="name" type="text" required className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Dr. Juan Pérez" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
              <input name="email" type="email" required className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="juan@ejemplo.com" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input name="password" type="password" required className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="******" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad</label>
              <input name="specialty" type="text" required className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Ej: Psicología Clínica" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº de Matrícula / Licencia</label>
              <input name="licenseNumber" type="text" required className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Ej: MN-12345" />
            </div>
            
            {/* --- CAMPO DE CV OBLIGATORIO --- */}
            <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Curriculum Vitae (PDF) <span className="text-red-500">*</span>
              </label>
              <input 
                type="file" 
                accept=".pdf" 
                onChange={handleFileChange}
                required
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                " 
              />
              <p className="mt-1 text-xs text-gray-500">Máximo 2MB. Formato .pdf</p>
            </div>

          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !file}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            >
              {loading ? 'Subiendo CV y Registrando...' : 'Registrarse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}