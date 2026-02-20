// src/app/panel/admin/servicios/page.js
import { prisma } from "@/lib/prisma";
import { createService } from "@/actions/service-actions";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      isActive: true,
      // Contamos APPROVED sin depender de _count.professionals (que ya no existe)
      professionalAssignments: {
        where: { status: "APPROVED" },
        select: { professionalId: true },
      },
      // Para mostrar pendientes (opcional)
      pending: {
        where: { status: "PENDING" },
        select: { professionalId: true },
      },
    },
  });

  async function handleCreate(formData) {
    "use server";
    const res = await createService(formData);
    if (res?.success) redirect(`/panel/admin/servicios/${res.newId}`);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-start gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Catálogo de Servicios</h1>
          <p className="text-slate-500 mt-2">Define qué ofrece la plataforma.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800">✨ Nuevo Servicio</h2>
        <form action={handleCreate} className="mt-4 grid md:grid-cols-3 gap-3">
          <input
            name="title"
            placeholder="Título"
            className="rounded-xl border border-slate-300 px-3 py-2"
            required
          />
          <input
            name="price"
            placeholder="Precio Base"
            className="rounded-xl border border-slate-300 px-3 py-2"
            type="number"
            step="0.01"
            required
          />
          <button className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700">
            Crear y Configurar →
          </button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {services.map((service) => {
          const approvedCount = service.professionalAssignments?.length || 0;
          const pendingCount = service.pending?.length || 0;

          return (
            <div key={service.id} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{service.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {service.isActive ? "ACTIVO" : "INACTIVO"}
                  </p>
                </div>

                <Link
                  href={`/panel/admin/servicios/${service.id}`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Gestionar ⚙️
                </Link>
              </div>

              <p className="text-slate-600 mt-3">{service.description || "Sin descripción."}</p>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-slate-200 px-3 py-1">
                  {approvedCount} aprobados
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
                  {pendingCount} pendientes
                </span>
              </div>
            </div>
          );
        })}

        {services.length === 0 && (
          <div className="text-slate-600">No hay servicios. Crea el primero arriba.</div>
        )}
      </div>
    </div>
  );
}
