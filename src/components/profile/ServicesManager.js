//src/components/profile/ServicesManager.js

'use client';

import { useState } from 'react';
import { manageService } from '@/actions/profile-actions';

export default function ServicesManager({ services = [] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentService, setCurrentService] = useState(null); // null = nuevo, obj = editar
  const [loading, setLoading] = useState(false);

  // Formulario inicial vacío
  const emptyForm = { title: '', description: '', price: '', durationMin: '60' };
  const [formData, setFormData] = useState(emptyForm);

  const openNew = () => {
    setCurrentService(null);
    setFormData(emptyForm);
    setIsEditing(true);
  };

  const openEdit = (svc) => {
    setCurrentService(svc);
    setFormData({
      title: svc.title,
      description: svc.description || '',
      price: svc.price,
      durationMin: svc.durationMin
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if(!confirm("¿Estás seguro de borrar este servicio?")) return;
    await manageService('DELETE', { id });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const action = currentService ? 'UPDATE' : 'CREATE';
    const payload = currentService ? { ...formData, id: currentService.id } : formData;

    const res = await manageService(action, payload);

    if (res.success) {
      setIsEditing(false);
      setFormData(emptyForm);
    } else {
      alert("Error: " + res.error);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800">Mis Servicios</h3>
        <button 
          onClick={openNew}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
        >
          + Crear Servicio
        </button>
      </div>

      {/* LISTA DE SERVICIOS */}
      <div className="space-y-4">
        {services.length === 0 ? (
          <p className="text-gray-500 text-sm italic text-center py-4">No tienes servicios configurados.</p>
        ) : (
          services.map(svc => (
            <div key={svc.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <h4 className="font-bold text-gray-900">{svc.title}</h4>
                <p className="text-xs text-gray-500">{svc.durationMin} min • ${Number(svc.price)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(svc)} className="text-xs text-blue-600 hover:underline">Editar</button>
                <button onClick={() => handleDelete(svc.id)} className="text-xs text-red-600 hover:underline">Borrar</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL / FORMULARIO (Inline por simplicidad) */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">{currentService ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Título</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="Ej: Consulta General"/>
              </div>
              
              <div className="flex gap-4">
                <div className="w-1/2">
                   <label className="block text-xs font-bold text-gray-500 uppercase">Precio ($)</label>
                   <input required type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border rounded p-2 text-sm"/>
                </div>
                <div className="w-1/2">
                   <label className="block text-xs font-bold text-gray-500 uppercase">Duración (min)</label>
                   <input required type="number" min="15" step="15" value={formData.durationMin} onChange={e => setFormData({...formData, durationMin: e.target.value})} className="w-full border rounded p-2 text-sm"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Descripción</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border rounded p-2 text-sm" rows="3"></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-700 text-sm">Cancelar</button>
                <button disabled={loading} type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}