// src/components/profile/ProfileEditor.js
'use client';

import { useState } from 'react';
import { updateProfile } from '@/actions/profile-actions';
import { supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

export default function ProfileEditor({ profile, allServices = [] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // 1. Estado para datos de texto
  // Nota: Accedemos a profile.user.name porque el nombre vive en la tabla User
  const [form, setForm] = useState({
    name: profile.user?.name || '',
    specialty: profile.specialty || '',
    licenseNumber: profile.licenseNumber || '',
    bio: profile.bio || ''
  });

  // 2. Estado para Servicios (Array de IDs)
  // Inicializamos con los servicios que el perfil YA tiene conectados
  const [selectedServices, setSelectedServices] = useState(
    profile.services ? profile.services.map(s => s.id) : []
  );

  // 3. Estado para Imagen
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(profile.user?.image || null);

  // --- MANEJADORES ---

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleServiceToggle = (serviceId) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId); // Desmarcar
      } else {
        return [...prev, serviceId]; // Marcar
      }
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Crear preview local instantáneo
    setPreviewUrl(URL.createObjectURL(file));
    setAvatarFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      let publicUrl = null;

      // A. Si hay nueva imagen, subir a Supabase
      if (avatarFile) {
        // Nombre único: ID_usuario-Timestamp.ext
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${profile.userId}-${Date.now()}.${fileExt}`;

        // Subir al bucket 'avatars' (Asegúrate de crearlo en Supabase)
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile);

        if (uploadError) throw new Error("Error subiendo imagen: " + uploadError.message);

        // Obtener URL pública
        const { data } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        
        publicUrl = data.publicUrl;
      }

      // B. Preparar FormData para el Server Action
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('specialty', form.specialty);
      formData.append('licenseNumber', form.licenseNumber);
      formData.append('bio', form.bio);
      
      // Si subimos foto nueva, enviamos la URL. Si no, no enviamos nada (se mantiene la vieja)
      if (publicUrl) formData.append('imageUrl', publicUrl);

      // Agregamos cada servicio seleccionado
      selectedServices.forEach(id => formData.append('serviceIds', id));

      // C. Enviar al Backend
      const res = await updateProfile(formData);

      if (res.success) {
        setMsg({ type: 'success', text: '✅ Perfil guardado correctamente' });
        router.refresh(); // Refrescar para ver cambios en el header/dashboard
      } else {
        setMsg({ type: 'error', text: '❌ ' + res.error });
      }

    } catch (error) {
      console.error(error);
      setMsg({ type: 'error', text: 'Ocurrió un error inesperado.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      
      {/* MENSAJE DE ESTADO */}
      {msg.text && (
        <div className={`p-4 rounded-lg font-medium text-center ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* 1. SECCIÓN FOTO */}
        <div className="md:col-span-1 flex flex-col items-center gap-4">
            <div className="relative group w-48 h-48 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner bg-slate-100">
                {previewUrl ? (
                    <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl text-slate-300">👤</div>
                )}
                
                {/* Overlay Hover */}
                <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                    <span className="text-2xl mb-1">📷</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Cambiar Foto</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
            </div>
            <p className="text-xs text-slate-400 text-center px-4">
                Haz clic en la imagen para subir una nueva.<br/>(Recomendado: 500x500px)
            </p>
        </div>

        {/* 2. DATOS PERSONALES */}
        <div className="md:col-span-2 space-y-5">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Información Pública</h3>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre y Apellido</label>
                <input 
                    name="name" 
                    type="text" 
                    required
                    value={form.name}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Especialidad (Título)</label>
                    <input 
                        name="specialty" 
                        type="text" 
                        value={form.specialty}
                        onChange={handleInputChange}
                        placeholder="Ej: Psicólogo Clínico"
                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Matrícula / Licencia</label>
                    <input 
                        name="licenseNumber" 
                        type="text" 
                        value={form.licenseNumber}
                        onChange={handleInputChange}
                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Biografía</label>
                <textarea 
                    name="bio" 
                    rows="4" 
                    value={form.bio}
                    onChange={handleInputChange}
                    placeholder="Describe tu experiencia y enfoque terapéutico..."
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3"
                ></textarea>
            </div>
        </div>
      </div>

      {/* 3. SELECTOR DE SERVICIOS */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Mis Servicios</h3>
        <p className="text-slate-500 text-sm mb-6">
            Selecciona los tipos de atención que brindas. Esto permitirá que los pacientes te encuentren en los filtros.
        </p>

        {allServices.length === 0 ? (
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                ⚠️ No hay servicios disponibles en el sistema. Contacta al administrador.
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allServices.map(service => {
                    const isSelected = selectedServices.includes(service.id);
                    return (
                        <div 
                            key={service.id}
                            onClick={() => handleServiceToggle(service.id)}
                            className={`relative cursor-pointer border rounded-xl p-4 transition-all flex items-start gap-3 select-none
                                ${isSelected 
                                    ? 'border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600' 
                                    : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}
                        >
                            <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                                ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <div>
                                <p className={`font-bold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                    {service.title}
                                </p>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {service.description || "Sin descripción"}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                                        {service.durationMin} min
                                    </span>
                                    <span className="text-xs font-semibold text-green-700">
                                        Ref: ${service.price}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* BOTÓN GUARDAR */}
      <div className="flex justify-end pt-4">
        <button 
            type="submit" 
            disabled={loading}
            className={`px-8 py-3 bg-blue-900 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-blue-800 hover:shadow-xl transition-all transform hover:-translate-y-0.5
                ${loading ? 'opacity-70 cursor-wait' : ''}`}
        >
            {loading ? (
                <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                </span>
            ) : "Guardar Cambios"}
        </button>
      </div>

    </form>
  );
}