//src/app/panel/admin/servicios/[id]/page.js
import { prisma } from "@/lib/prisma";
import { updateServiceDetails, addProfessionalToService, removeProfessionalFromService, deleteService } from "@/actions/service-actions";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function ServiceDetailPage({ params }) {
  const serviceId = params.id;

  // 1. Obtener el servicio y sus profesionales actuales
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      professionals: { // Relación Many-to-Many
        include: { user: true }
      }
    }
  });

  if (!service) return <div>Servicio no encontrado</div>;

  // 2. Obtener TODOS los profesionales disponibles (para el selector de "Agregar")
  // Excluimos los que YA están en el servicio
  const currentProIds = service.professionals.map(p => p.id);
  
  const availablePros = await prisma.professionalProfile.findMany({
    where: {
        id: { notIn: currentProIds },
        user: { isActive: true, isApproved: true } // Solo mostrar gente apta
    },
    include: { user: true },
    orderBy: { user: { name: 'asc' } }
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/panel/admin/servicios" className="hover:underline">Catálogo</Link>
        <span>/</span>
        <span className="font-bold text-slate-800">{service.title}</span>
      </div>

      <div className="flex justify-between items-start">
        <h1 className="text-3xl font-bold text-slate-800">Gestionar Servicio</h1>
        <form action={async () => {
            'use server';
            if(confirm('¿Borrar servicio?')) {
                await deleteService(serviceId);
                redirect('/panel/admin/servicios');
            }
        }}>
            <button className="text-red-500 text-sm hover:underline font-bold">Eliminar Servicio</button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQUIERDA: EDICIÓN DE DATOS */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Configuración General</h3>
                <form action={updateServiceDetails.bind(null, serviceId)} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Título del Servicio</label>
                        <input name="title" defaultValue={service.title} className="w-full border rounded p-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Precio Base ($)</label>
                        <input name="price" type="number" defaultValue={service.price} className="w-full border rounded p-2 text-sm" />
                        <p className="text-[10px] text-slate-400 mt-1">*Precio sugerido por defecto</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Duración (minutos)</label>
                        <input name="durationMin" type="number" defaultValue={service.durationMin} className="w-full border rounded p-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Descripción</label>
                        <textarea name="description" rows={4} defaultValue={service.description || ''} className="w-full border rounded p-2 text-sm"></textarea>
                    </div>
                    <button className="w-full bg-slate-900 text-white py-2 rounded font-bold text-sm hover:bg-black transition">
                        Guardar Cambios
                    </button>
                </form>
            </div>
        </div>

        {/* COLUMNA DERECHA: GESTIÓN DE PROFESIONALES */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* 1. AGREGAR NUEVO PROFESIONAL */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-900 mb-2">➕ Agregar Profesional al Servicio</h3>
                <p className="text-xs text-blue-700 mb-4">Selecciona un profesional para habilitarlo en {service.title}.</p>
                
                <form action={async (formData) => {
                    'use server';
                    const proId = formData.get('professionalId');
                    if(proId) await addProfessionalToService(serviceId, proId);
                }} className="flex gap-2">
                    <select name="professionalId" className="flex-grow border-blue-200 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">-- Seleccionar Profesional --</option>
                        {availablePros.map(pro => (
                            <option key={pro.id} value={pro.id}>
                                {pro.user.name} ({pro.specialty || 'General'})
                            </option>
                        ))}
                    </select>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-blue-700">
                        Agregar
                    </button>
                </form>
            </div>

            {/* 2. LISTA DE PROFESIONALES ACTUALES */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-700">Staff Asignado ({service.professionals.length})</h3>
                </div>
                
                {service.professionals.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        Nadie ofrece este servicio todavía.
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <tbody className="divide-y divide-slate-100">
                            {service.professionals.map(pro => (
                                <tr key={pro.id} className="group hover:bg-slate-50">
                                    <td className="p-3">
                                        <div className="font-bold text-slate-800 text-sm">{pro.user.name}</div>
                                        <div className="text-xs text-slate-500">{pro.specialty}</div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <form action={removeProfessionalFromService.bind(null, serviceId, pro.id)}>
                                            <button className="text-red-400 hover:text-red-600 font-bold text-xs border border-transparent hover:border-red-200 px-2 py-1 rounded transition">
                                                Quitar 🗑️
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

        </div>

      </div>
    </div>
  );
}
