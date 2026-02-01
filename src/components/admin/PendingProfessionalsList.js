src/components/admin/PendingProfessionalsList.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// 👇 IMPORTANTE: Traemos las acciones del servidor
import { approveProfessional, rejectProfessional } from '@/actions/admin-actions';

// Nota: Cambié el nombre de la prop a 'professionals' para que coincida con lo que manda el page.js
export default function PendingProfessionalsList({ professionals = [] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState(null); // Para saber cuál botón específico está cargando

  const handleApprove = async (proId, proName) => {
    if (!confirm(`¿Estás seguro de aprobar a ${proName}? Será visible en la web pública.`)) return;

    setLoadingId(proId); // Bloqueamos solo esta fila
    try {
      // 👇 Llamada directa a Server Action (Adiós fetch)
      const res = await approveProfessional(proId);

      if (res.error) {
        throw new Error(res.error);
      }

      alert(`✅ ${proName} ha sido aprobado.`);
      router.refresh(); // Recarga la data sin refrescar el navegador
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (proId, proName) => {
    if (!confirm(`⚠️ ¿RECHAZAR y ELIMINAR a ${proName}? Esta acción no se puede deshacer.`)) return;

    setLoadingId(proId);
    try {
      const res = await rejectProfessional(proId);
      if (res.error) throw new Error(res.error);
      
      alert(`🗑️ Solicitud de ${proName} rechazada.`);
      router.refresh();
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoadingId(null);
    }
  };

  if (professionals.length === 0) {
    return (
      <div className="p-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <p className="text-gray-500">No hay profesionales pendientes de revisión. ¡Todo al día!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profesional</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Registro</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {professionals.map((pro) => (
            <tr key={pro.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold uppercase">
                    {pro.name.charAt(0)}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{pro.name}</div>
                    {/* 👇 Corregido: profession -> specialty */}
                    <div className="text-sm text-gray-500">{pro.specialty || 'Sin especialidad'}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{pro.email}</div>
                {pro.phone && <div className="text-sm text-gray-500">{pro.phone}</div>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(pro.createdAt).toLocaleDateString('es-AR')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {/* 👇 Corregido: resumeUrl -> cvUrl */}
                {pro.cvUrl && (
                  <a href={pro.cvUrl} target="_blank" className="text-blue-600 hover:text-blue-900 mr-4 underline">
                    Ver CV
                  </a>
                )}
                
                <div className="inline-flex gap-2">
                  <button
                    onClick={() => handleApprove(pro.id, pro.name)}
                    disabled={loadingId === pro.id}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {loadingId === pro.id ? '...' : 'Aprobar'}
                  </button>

                  <button
                    onClick={() => handleReject(pro.id, pro.name)}
                    disabled={loadingId === pro.id}
                    className="inline-flex items-center px-3 py-1.5 border border-red-200 text-xs font-medium rounded-md text-red-600 bg-white hover:bg-red-50 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}