'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PendingProfessionalsList({ initialData }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async (proId, proName) => {
    if (!confirm(`¿Estás seguro de aprobar a ${proName}? Será visible en la web pública.`)) return;

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/professionals/${proId}/approve`, {
        method: 'POST',
      });

      // 1. Leemos la respuesta del servidor (aquí viene el error real)
      const data = await res.json();

      // 2. Si falló, lanzamos el mensaje específico que mandó el servidor
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Falló la aprobación (Error desconocido)');
      }

      alert(`✅ ${proName} ha sido aprobado.`);
      
      // Recargamos la página para que la lista se actualice
      router.refresh(); 
      
    } catch (error) {
      // 3. Ahora la alerta mostrará la causa real (ej: "No autorizado", "Token inválido")
      alert('❌ Error: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (initialData.length === 0) {
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
          {initialData.map((pro) => (
            <tr key={pro.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold">
                    {pro.name.charAt(0)}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{pro.name}</div>
                    <div className="text-sm text-gray-500">{pro.profession}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{pro.email}</div>
                {pro.phone && <div className="text-sm text-gray-500">{pro.phone}</div>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(pro.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {pro.resumeUrl && (
                  <a href={pro.resumeUrl} target="_blank" className="text-blue-600 hover:text-blue-900 mr-4">
                    Ver CV
                  </a>
                )}
                <button
                  onClick={() => handleApprove(pro.id, pro.name)}
                  disabled={isProcessing}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {isProcessing ? '...' : 'Aprobar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}