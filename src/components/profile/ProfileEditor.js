//src/components/profile/ProfileEditor.js

'use client';

import { updateProfile } from '@/actions/profile-actions';
import { useState } from 'react';

export default function ProfileEditor({ profile }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    
    const res = await updateProfile(formData);
    
    if (res.success) {
      alert("✅ Perfil actualizado");
    } else {
      alert("❌ " + res.error);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Información Pública</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
        <input name="name" defaultValue={profile.name} type="text" className="mt-1 w-full border border-gray-300 rounded-md p-2" required />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Especialidad (Título visible)</label>
        <input name="specialty" defaultValue={profile.specialty || ''} type="text" placeholder="Ej: Psicólogo Clínico" className="mt-1 w-full border border-gray-300 rounded-md p-2" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Biografía</label>
        <textarea name="bio" defaultValue={profile.bio || ''} rows="4" placeholder="Cuenta un poco sobre ti..." className="mt-1 w-full border border-gray-300 rounded-md p-2"></textarea>
      </div>

      {/* URL de Avatar temporal hasta que integremos subida de archivos real */}
      <div>
        <label className="block text-sm font-medium text-gray-700">URL Foto de Perfil (Opcional)</label>
        <input name="avatarUrl" defaultValue={profile.avatarUrl || ''} type="url" placeholder="https://..." className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm text-gray-500" />
      </div>

      <div className="pt-2 text-right">
        <button disabled={loading} className="bg-gray-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-black transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  );
}