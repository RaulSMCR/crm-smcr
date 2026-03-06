import { getSession } from "@/actions/auth-actions";
import { redirect } from "next/navigation";
import { getAdminAppointments } from "@/actions/admin-appointments-actions";
import AdminAppointmentsManager from "@/components/admin/AdminAppointmentsManager";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "PENDING", label: "Pendientes" },
  { value: "CONFIRMED", label: "Confirmadas" },
  { value: "COMPLETED", label: "Completadas" },
  { value: "NO_SHOW", label: "No asistio" },
  { value: "CANCELLED_BY_USER", label: "Canceladas por paciente" },
  { value: "CANCELLED_BY_PRO", label: "Canceladas por profesional" },
];

const RESCHEDULED_BY_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "PATIENT", label: "Reagendadas por paciente" },
  { value: "PROFESSIONAL", label: "Reagendadas por profesional" },
  { value: "ADMIN", label: "Reagendadas por admin" },
];

const PAYMENT_STATE_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "PAID", label: "Pagadas" },
  { value: "PENDING", label: "Pendientes de pago" },
];

function getParam(searchParams, key) {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
}

export default async function AdminCitasPage({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const statusFilter = getParam(searchParams, "status");
  const rescheduledByFilter = getParam(searchParams, "rescheduledBy");
  const paymentStateFilter = getParam(searchParams, "paymentState");
  const professionalIdFilter = getParam(searchParams, "professionalId");
  const patientIdFilter = getParam(searchParams, "patientId");

  const all = await getAdminAppointments();
  const now = new Date();

  const appointments = all.filter((appointment) => {
    if (statusFilter && appointment.status !== statusFilter) return false;
    if (rescheduledByFilter && appointment.lastRescheduledBy !== rescheduledByFilter) return false;
    if (paymentStateFilter === "PAID" && appointment.paymentStatus !== "PAID") return false;
    if (paymentStateFilter === "PENDING" && appointment.paymentStatus === "PAID") return false;
    if (professionalIdFilter && appointment.professionalId !== professionalIdFilter) return false;
    if (patientIdFilter && appointment.patientId !== patientIdFilter) return false;
    return true;
  });

  const overdueAlerts = all.filter((appointment) => {
    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) return false;
    return new Date(appointment.endDate) < now;
  });

  const pending = all.filter((a) => a.status === "PENDING").length;
  const confirmed = all.filter((a) => a.status === "CONFIRMED").length;
  const cancelled = all.filter((a) => a.status.startsWith("CANCELLED")).length;
  const completed = all.filter((a) => a.status === "COMPLETED").length;

  const professionals = Array.from(
    new Map(
      all
        .filter((appointment) => appointment.professionalId && appointment.professional?.user?.name)
        .map((appointment) => [
          appointment.professionalId,
          {
            id: appointment.professionalId,
            name: appointment.professional.user.name,
          },
        ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, "es"));

  const patients = Array.from(
    new Map(
      all
        .filter((appointment) => appointment.patientId && appointment.patient?.name)
        .map((appointment) => [
          appointment.patientId,
          {
            id: appointment.patientId,
            name: appointment.patient.name,
          },
        ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/panel/admin" className="text-sm text-slate-400 transition hover:text-slate-600">
            Volver al panel
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gestion de Citas</h1>
            <p className="text-sm text-slate-500">Consulta y actualiza el estado de todas las citas.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Pendientes</p>
            <p className="mt-1 text-3xl font-bold text-amber-500">{pending}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Confirmadas</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{confirmed}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Canceladas</p>
            <p className="mt-1 text-3xl font-bold text-red-500">{cancelled}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Completadas</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{completed}</p>
          </div>
        </div>

        {overdueAlerts.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">
              Alertas: {overdueAlerts.length} cita(s) superaron su hora estimada de finalizacion y siguen sin cierre.
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {overdueAlerts.slice(0, 8).map((appointment) => (
                <div key={appointment.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold">{appointment.patient?.name || "Paciente sin nombre"}</span>
                  {" - "}
                  {appointment.professional?.user?.name || "Profesional sin nombre"}
                  {" - "}
                  {new Date(appointment.endDate).toLocaleString("es-CR")}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <form className="grid gap-3 md:grid-cols-6" method="GET">
            <label className="text-xs font-semibold text-slate-600">
              Estado
              <select name="status" defaultValue={statusFilter} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Reagendada por
              <select
                name="rescheduledBy"
                defaultValue={rescheduledByFilter}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                {RESCHEDULED_BY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Pago
              <select name="paymentState" defaultValue={paymentStateFilter} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
                {PAYMENT_STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Profesional
              <select
                name="professionalId"
                defaultValue={professionalIdFilter}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="">Todos</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Paciente
              <select name="patientId" defaultValue={patientIdFilter} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
                <option value="">Todos</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button type="submit" className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Aplicar
              </button>
              <Link
                href="/panel/admin/citas"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Limpiar
              </Link>
            </div>
          </form>
        </div>

        <AdminAppointmentsManager appointments={appointments} />
      </div>
    </div>
  );
}
