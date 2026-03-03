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
  { value: "NO_SHOW", label: "No asistió" },
  { value: "CANCELLED_BY_USER", label: "Canceladas por paciente" },
  { value: "CANCELLED_BY_PRO", label: "Canceladas por profesional" },
];

export default async function AdminCitasPage({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const statusFilter = searchParams?.status || "";
  const all = await getAdminAppointments();

  const appointments = statusFilter
    ? all.filter((a) => a.status === statusFilter)
    : all;

  const pending = all.filter((a) => a.status === "PENDING").length;
  const confirmed = all.filter((a) => a.status === "CONFIRMED").length;
  const cancelled = all.filter((a) => a.status.startsWith("CANCELLED")).length;
  const completed = all.filter((a) => a.status === "COMPLETED").length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Encabezado */}
        <div className="flex items-center gap-4">
          <Link href="/panel/admin" className="text-slate-400 hover:text-slate-600 text-sm transition">
            ← Panel
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gestión de Citas</h1>
            <p className="text-slate-500 text-sm">Consulta y actualiza el estado de todas las citas.</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pendientes</p>
            <p className="text-3xl font-bold text-amber-500 mt-1">{pending}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Confirmadas</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{confirmed}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Canceladas</p>
            <p className="text-3xl font-bold text-red-500 mt-1">{cancelled}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Completadas</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{completed}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-600 mr-1">Filtrar:</span>
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={`/panel/admin/citas${opt.value ? `?status=${opt.value}` : ""}`}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                statusFilter === opt.value
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        {/* Tabla */}
        <AdminAppointmentsManager appointments={appointments} />
      </div>
    </div>
  );
}
