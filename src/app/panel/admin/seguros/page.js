// src/app/panel/admin/seguros/page.js
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fileApiUrl } from "@/lib/storage";

const privateFileUrl = (value) => {
  const [bucket, ...parts] = String(value || "").split("/");
  return fileApiUrl(bucket, parts.join("/"));
};
import { getSession } from "@/actions/auth-actions";
import InsurancePatientsManager from "@/components/admin/InsurancePatientsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSegurosPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const [insuredPatients, activeClaims] = await Promise.all([
    prisma.user.findMany({
      where: { hasInsurance: true, useInsuranceForPayment: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        insuranceName: true,
        insuranceBlankFormUrl: true,
        insuranceBlankFormUploadedAt: true,
        insurancePatientFormUrl: true,
        insurancePatientFormUploadedAt: true,
        insuranceTemplateUrl: true,
        insuranceTemplateUploadedAt: true,
      },
    }),
    prisma.insuranceClaim.findMany({
      where: { status: { in: ["AWAITING_TEMPLATE", "PENDING_SIGNED_FORM"] } },
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { name: true, insuranceName: true } },
        professional: { select: { user: { select: { name: true } } } },
        appointment: { select: { date: true } },
      },
    }),
  ]);

  function getSetupStatus(p) {
    if (!p.insuranceBlankFormUrl) return { label: "Sin formulario en blanco", color: "bg-red-100 text-red-700" };
    if (!p.insurancePatientFormUrl) return { label: "Esperando datos del paciente", color: "bg-amber-100 text-amber-700" };
    if (!p.insuranceTemplateUrl) return { label: "Esperando plantilla del profesional", color: "bg-yellow-100 text-yellow-700" };
    return { label: "Listo", color: "bg-green-100 text-green-700" };
  }

  return (
    <div className="min-h-screen bg-appbg p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/panel/admin" className="text-sm text-slate-500 hover:text-slate-700">
            ← Panel admin
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Seguros médicos</h1>
        </div>

        {/* ── Pacientes con seguro ── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">
            Pacientes con seguro médico ({insuredPatients.length})
          </h2>

          {insuredPatients.length === 0 ? (
            <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 p-6">
              Ningún paciente ha registrado seguro médico todavía.
            </p>
          ) : (
            <div className="space-y-4">
              {insuredPatients.map((p) => {
                const status = getSetupStatus(p);
                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="text-sm text-slate-500">{p.email}</p>
                        {p.insuranceName && (
                          <p className="text-sm text-slate-600 mt-1">
                            Seguro: <strong>{p.insuranceName}</strong>
                          </p>
                        )}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {p.insuranceBlankFormUrl && (
                        <a
                          href={privateFileUrl(p.insuranceBlankFormUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Ver formulario en blanco ↗
                        </a>
                      )}
                      {p.insurancePatientFormUrl && (
                        <a
                          href={privateFileUrl(p.insurancePatientFormUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Ver formulario del paciente ↗
                        </a>
                      )}
                      {p.insuranceTemplateUrl && (
                        <a
                          href={privateFileUrl(p.insuranceTemplateUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Ver plantilla del profesional ↗
                        </a>
                      )}
                    </div>

                    <InsurancePatientsManager patientId={p.id} patientName={p.name} />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Reclamos activos ── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">
            Reclamos en curso ({activeClaims.length})
          </h2>

          {activeClaims.length === 0 ? (
            <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 p-6">
              No hay reclamos activos en este momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="px-4 py-2 font-semibold text-slate-700 rounded-tl-xl">Paciente</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Seguro</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Profesional</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Fecha de pago</th>
                    <th className="px-4 py-2 font-semibold text-slate-700 rounded-tr-xl">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {activeClaims.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">{c.patient.name}</td>
                      <td className="px-4 py-3 text-slate-600">{c.patient.insuranceName || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.professional?.user?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.paymentDate
                          ? new Date(c.paymentDate).toLocaleDateString("es-CR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {c.status === "AWAITING_TEMPLATE" ? (
                          <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                            Sin plantilla
                          </span>
                        ) : (
                          <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-semibold">
                            Pendiente firma
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
