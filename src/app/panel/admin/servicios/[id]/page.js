//src/app/panel/admin/servicios/[id]/page.js
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  updateServiceDetails,
  addProfessionalToService,
  removeProfessionalFromService,
  deleteService,
} from "@/actions/service-actions";
import DeleteServiceButton from "@/components/admin/DeleteServiceButton";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({ params }) {
  const serviceId = params.id;

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { professionals: { include: { user: true } } },
  });

  if (!service) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Servicio no encontrado</h1>
        <Link className="text-blue-600 underline" href="/panel/admin/servicios">
          Volver
        </Link>
      </div>
    );
  }

  const currentProIds = service.professionals.map((p) => p.id);

  // ✅ Fix: isApproved vive en ProfessionalProfile, no en User
  const availablePros = await prisma.professionalProfile.findMany({
    where: {
      id: { notIn: currentProIds },
      isApproved: true,
      user: { isActive: true },
    },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  async function deleteAction() {
    "use server";
    await deleteService(serviceId);
    redirect("/panel/admin/servicios");
  }

  async function updateDetailsAction(formData) {
    "use server";
    await updateServiceDetails(serviceId, formData);
  }

  async function addProAction(formData) {
    "use server";
    const proId = formData.get("professionalId");
    if (proId) await addProfessionalToService(serviceId, String(proId));
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">
            <Link className="text-blue-600 hover:underline" href="/panel/admin/servicios">
              Catálogo
            </Link>{" "}
            / {service.title}
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mt-1">Gestionar Servicio</h1>
        </div>

        <DeleteServiceButton action={deleteAction} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* IZQUIERDA: CONFIG */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800">Configuración general</h3>

          <form action={updateDetailsAction} className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Título</label>
              <input
                name="title"
                defaultValue={service.title}
                className="mt-1 w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Precio base ($)</label>
                <input
                  name="price"
                  defaultValue={String(service.price)}
                  className="mt-1 w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Duración (min)</label>
                <input
                  name="durationMin"
                  defaultValue={String(service.durationMin)}
                  className="mt-1 w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <textarea
                name="description"
                defaultValue={service.description || ""}
                rows={5}
                className="mt-1 w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <button className="rounded-xl bg-blue-600 text-white px-5 py-2.5 font-semibold shadow-sm hover:bg-blue-700">
              Guardar cambios
            </button>
          </form>
        </div>

        {/* DERECHA: STAFF */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Staff asignado</h3>
            <p className="text-sm text-slate-500 mt-1">
              Profesionales habilitados para <span className="font-medium">{service.title}</span>.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="font-semibold text-slate-800">➕ Agregar profesional</div>
            <form action={addProAction} className="mt-3 flex gap-2">
              <select
                name="professionalId"
                className="flex-1 rounded-lg border-slate-300 bg-white py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  -- Seleccionar profesional --
                </option>
                {availablePros.map((pro) => (
                  <option key={pro.id} value={pro.id}>
                    {pro.user?.name || "(Sin nombre)"} ({pro.specialty || "General"})
                  </option>
                ))}
              </select>
              <button className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700">
                Agregar
              </button>
            </form>
          </div>

          <div>
            <div className="font-semibold text-slate-800 mb-2">
              Staff actual ({service.professionals.length})
            </div>

            {service.professionals.length === 0 ? (
              <div className="text-sm text-slate-500">Nadie ofrece este servicio todavía.</div>
            ) : (
              <div className="space-y-2">
                {service.professionals.map((pro) => {
                  async function removeAction() {
                    "use server";
                    await removeProfessionalFromService(serviceId, pro.id);
                  }

                  return (
                    <div
                      key={pro.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{pro.user?.name}</div>
                        <div className="text-sm text-slate-500">{pro.specialty || "General"}</div>
                      </div>

                      <form action={removeAction}>
                        <button className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl hover:bg-rose-100">
                          Quitar
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
