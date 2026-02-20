// src/app/panel/admin/servicios/[id]/page.js
import { prisma } from "@/lib/prisma";
import {
  updateServiceDetails,
  addProfessionalToService,
  removeProfessionalFromService,
  approveServiceAssignment,
  rejectServiceAssignment,
  deleteService,
} from "@/actions/service-actions";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({ params }) {
  const serviceId = params.id;

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      professionalAssignments: {
        include: {
          professional: { include: { user: true } },
        },
      },
    },
  });

  if (!service) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold">Servicio no encontrado</h1>
        <Link href="/panel/admin/servicios" className="text-blue-600 hover:underline">
          Volver
        </Link>
      </div>
    );
  }

  const assignments = service.professionalAssignments || [];
  const approved = assignments.filter((a) => a.status === "APPROVED");
  const pending = assignments.filter((a) => a.status === "PENDING");
  const rejected = assignments.filter((a) => a.status === "REJECTED");

  const currentProIds = assignments.map((a) => a.professionalId);

  const availablePros = await prisma.professionalProfile.findMany({
    where: {
      id: { notIn: currentProIds },
      user: { isActive: true, isApproved: true },
    },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  async function handleUpdate(formData) {
    "use server";
    await updateServiceDetails(serviceId, formData);
    redirect(`/panel/admin/servicios/${serviceId}`);
  }

  async function handleAdd(formData) {
    "use server";
    const proId = String(formData.get("professionalId") || "");
    if (proId) await addProfessionalToService(serviceId, proId);
    redirect(`/panel/admin/servicios/${serviceId}`);
  }

  async function handleApprove(formData) {
    "use server";
    const proId = String(formData.get("professionalId") || "");
    if (proId) await approveServiceAssignment(serviceId, proId);
    redirect(`/panel/admin/servicios/${serviceId}`);
  }

  async function handleReject(formData) {
    "use server";
    const proId = String(formData.get("professionalId") || "");
    if (proId) await rejectServiceAssignment(serviceId, proId);
    redirect(`/panel/admin/servicios/${serviceId}`);
  }

  async function handleRemove(formData) {
    "use server";
    const proId = String(formData.get("professionalId") || "");
    if (proId) await removeProfessionalFromService(serviceId, proId);
    redirect(`/panel/admin/servicios/${serviceId}`);
  }

  async function handleDelete() {
    "use server";
    await deleteService(serviceId);
    redirect("/panel/admin/servicios");
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-600">
            <Link href="/panel/admin/servicios" className="hover:underline">
              Catálogo
            </Link>{" "}
            / {service.title}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Gestionar Servicio</h1>
        </div>

        <form action={handleDelete}>
          <button className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-2 font-semibold hover:bg-red-100">
            Eliminar Servicio
          </button>
        </form>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Config */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Configuración General</h2>

          <form action={handleUpdate} className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Título del Servicio</label>
              <input
                name="title"
                defaultValue={service.title}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Precio Base ($)</label>
                <input
                  name="price"
                  defaultValue={String(service.price)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Duración (min)</label>
                <input
                  name="durationMin"
                  defaultValue={String(service.durationMin)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <textarea
                name="description"
                defaultValue={service.description || ""}
                rows={5}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <button className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700">
              Guardar Cambios
            </button>
          </form>
        </div>

        {/* Staff */}
        <div className="space-y-6">
          {/* Agregar directo (APPROVED) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900">➕ Agregar Profesional (directo)</h3>
            <p className="text-sm text-slate-600 mt-1">
              Esto crea la asignación en estado <b>APPROVED</b>.
            </p>

            <form action={handleAdd} className="mt-4 flex gap-2">
              <select
                name="professionalId"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  -- Seleccionar Profesional --
                </option>
                {availablePros.map((pro) => (
                  <option key={pro.id} value={pro.id}>
                    {pro.user.name} ({pro.specialty || "General"})
                  </option>
                ))}
              </select>
              <button className="rounded-xl bg-slate-900 text-white px-4 py-2 font-semibold hover:bg-slate-800">
                Agregar
              </button>
            </form>
          </div>

          {/* Pendientes */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Solicitudes Pendientes ({pending.length})</h3>

            {pending.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">No hay solicitudes pendientes.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {pending.map((a) => (
                  <div key={a.professionalId} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="font-semibold text-slate-900">{a.professional.user.name}</div>
                    <div className="text-sm text-slate-700">{a.professional.specialty}</div>

                    <div className="mt-3 flex gap-2">
                      <form action={handleApprove}>
                        <input type="hidden" name="professionalId" value={a.professionalId} />
                        <button className="rounded-xl bg-green-600 text-white px-3 py-2 text-sm font-semibold hover:bg-green-700">
                          Aprobar
                        </button>
                      </form>
                      <form action={handleReject}>
                        <input type="hidden" name="professionalId" value={a.professionalId} />
                        <button className="rounded-xl bg-red-600 text-white px-3 py-2 text-sm font-semibold hover:bg-red-700">
                          Rechazar
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aprobados */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Staff Aprobado ({approved.length})</h3>

            {approved.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">Nadie ofrece este servicio todavía.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {approved.map((a) => (
                  <div key={a.professionalId} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{a.professional.user.name}</div>
                      <div className="text-sm text-slate-700">{a.professional.specialty}</div>
                    </div>
                    <form action={handleRemove}>
                      <input type="hidden" name="professionalId" value={a.professionalId} />
                      <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                        Quitar
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rechazados */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Rechazados ({rejected.length})</h3>
            {rejected.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">Sin rechazos.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {rejected.map((a) => (
                  <div key={a.professionalId} className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="font-semibold text-slate-900">{a.professional.user.name}</div>
                    <div className="text-sm text-slate-700">{a.professional.specialty}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
