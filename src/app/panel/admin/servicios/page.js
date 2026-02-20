// src/app/panel/admin/servicios/page.js
import { prisma } from "@/lib/prisma";
import { createService } from "@/actions/service-actions";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({
    orderBy: { title: "asc" },
    include: {
      _count: { select: { professionalAssignments: true } },
    },
  });

  async function handleCreate(formData) {
    "use server";
    const res = await createService(formData);
    if (res?.success) redirect(`/panel/admin/servicios/${res.newId}`);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Catálogo de Servicios</h1>
        <p className="text-slate-600 mt-2">Define qué ofrece la plataforma.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">✨ Nuevo Servicio</h2>
        <form action={handleCreate} className="mt-4 grid md:grid-cols-3 gap-3">
          <input
            name="title"
            placeholder="Título"
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
          <input
            name="price"
            placeholder="Precio Base"
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
          <button className="rounded-xl bg-slate-900 text-white px-4 py-2 font-semibold hover:bg-slate-800">
            Crear y Configurar →
          </button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {services.map((service) => (
          <div key={service.id} className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{service.title}</h3>
                <p className="text-slate-600 mt-1">{service.description || "Sin descripción."}</p>
              </div>
              <div className="text-xs text-slate-700 whitespace-nowrap">
                {service.isActive ? "ACTIVO" : "INACTIVO"}
              </div>
            </div>

            <div className="mt-3 text-sm text-slate-700">
              {service._count.professionalAssignments} asignación(es)
            </div>

            <div className="mt-4">
              <Link
                href={`/panel/admin/servicios/${service.id}`}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700"
              >
                Gestionar ⚙️
              </Link>
            </div>
          </div>
        ))}

        {services.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
            No hay servicios. Crea el primero arriba.
          </div>
        )}
      </div>
    </div>
  );
}
