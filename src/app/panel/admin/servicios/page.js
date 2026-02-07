//src/app/panel/admin/servicios/page.js
import { prisma } from "@/lib/prisma";
import { createService, deleteService } from "@/actions/service-actions"; // Importa del nuevo archivo
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({
    orderBy: { title: 'asc' },
    include: {
        _count: { select: { professionals: true } }
    }
  });

  // Server Action inline para manejar la redirección post-creación
  async function handleCreate(formData) {
    'use server';
    const res = await createService(formData);
    if (res.success) {
        redirect(`/panel/admin/servicios/${res.newId}`);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Catálogo de Servicios</h1>
            <p className="text-slate-500">Define qué ofrece la plataforma.</p>
        </div>
      </div>

      {/* FORMULARIO DE CREACIÓN RÁPIDA */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4">✨ Nuevo Servicio</h3>
        <form action={handleCreate} className="flex gap-4 items-end">
            <div className="flex-grow">
                <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
                <input name="title" required placeholder="Ej: Terapia de Pareja" className="w-full border rounded-lg p-2.5 bg-slate-50" />
            </div>
            <div className="w-32">
                <label className="text-xs font-bold text-slate-500 uppercase">Precio Base</label>
                <input name="price" type="number" required placeholder="0.00" className="w-full border rounded-lg p-2.5 bg-slate-50" />
            </div>
            <button className="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-blue-700 transition">
                Crear y Configurar &rarr;
            </button>
        </form>
      </div>

      {/* LISTA DE SERVICIOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map(service => (
            <div key={service.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition group">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-slate-800">{service.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${service.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {service.isActive ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                </div>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2 h-10">
                    {service.description || "Sin descripción."}
                </p>
                
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="text-xs text-slate-500">
                        <strong>{service._count.professionals}</strong> Profesionales
                    </div>
                    <div className="flex gap-2">
                         {/* BOTÓN CLAVE: IR AL DETALLE */}
                        <Link 
                            href={`/panel/admin/servicios/${service.id}`}
                            className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
                        >
                            Gestionar ⚙️
                        </Link>
                    </div>
                </div>
            </div>
        ))}
      </div>
      
      {services.length === 0 && <p className="text-center text-slate-400 mt-10">No hay servicios. Crea el primero arriba.</p>}
    </div>
  );
}