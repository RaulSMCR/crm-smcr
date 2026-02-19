// src/app/panel/admin/personal/page.js
import { prisma } from "@/lib/prisma";
import { rejectUser } from "@/actions/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminPersonnelPage() {
  // ✅ Profesionales aprobados = professionalProfile.isApproved = true
  const professionals = await prisma.user.findMany({
    where: {
      role: "PROFESSIONAL",
      professionalProfile: {
        is: { isApproved: true },
      },
    },
    include: {
      professionalProfile: {
        include: {
          _count: { select: { appointments: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Gestión de Personal</h1>
          <p className="text-slate-500">Directorio de profesionales activos en la plataforma.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border shadow-sm text-sm font-bold text-slate-700">
          Total Activos: {professionals.length}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Profesional</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Especialidad</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Rendimiento</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
              <th className="p-4 text-right text-xs font-bold text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {professionals.map((pro) => {
              const apptCount = pro.professionalProfile?._count?.appointments ?? 0;

              return (
                <tr key={pro.id} className="hover:bg-slate-50 transition">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{pro.name}</div>
                    <div className="text-xs text-slate-500">{pro.email}</div>
                    <div className="text-xs text-slate-400">{pro.phone}</div>
                  </td>

                  <td className="p-4 text-sm text-slate-600">
                    {pro.professionalProfile?.specialty || "Sin especialidad"}
                    <br />
                    <span className="text-xs text-slate-400">
                      Mat: {pro.professionalProfile?.licenseNumber || "-"}
                    </span>
                  </td>

                  <td className="p-4">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100">
                      {apptCount} Citas
                    </span>
                  </td>

                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold border ${
                        pro.isActive
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-red-100 text-red-700 border-red-200"
                      }`}
                    >
                      {pro.isActive ? "ACTIVO" : "SUSPENDIDO"}
                    </span>
                  </td>

                  <td className="p-4 text-right">
                    <form
                      action={async () => {
                        "use server";
                        await rejectUser(pro.id);
                      }}
                    >
                      <button className="text-xs font-bold text-red-500 hover:text-red-700 border border-red-200 px-3 py-1 rounded hover:bg-red-50 transition">
                        Dar de Baja
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {professionals.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <p>No hay profesionales activos en el sistema.</p>
          </div>
        )}
      </div>
    </div>
  );
}
