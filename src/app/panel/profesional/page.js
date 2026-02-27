import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDateTime(d) {
  try {
    return new Intl.DateTimeFormat("es-CR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return String(d);
  }
}

function getDayRange(baseDate) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function ProfesionalDashboardPage() {
  const session = await getSession();

  if (!session?.sub) redirect("/ingresar");
  if (session.role !== "PROFESSIONAL") redirect("/");

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: String(session.sub) },
    include: {
      user: true,
      serviceAssignments: {
        include: { service: true },
      },
      _count: {
        select: { posts: true, appointments: true },
      },
      appointments: {
        where: {
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        orderBy: { date: "asc" },
        include: {
          patient: { select: { name: true } },
          service: { select: { title: true } },
        },
        take: 20,
      },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, status: true, createdAt: true },
      },
    },
  });

  if (!profile) redirect("/espera-aprobacion");

  const assignedServices = (profile.serviceAssignments || [])
    .map((sa) => sa.service)
    .filter(Boolean);
  const activeAssignedServices = assignedServices.filter((s) => s.isActive);

  const now = new Date();
  const todayRange = getDayRange(now);
  const todayAppointments = (profile.appointments || []).filter(
    (a) => a.date >= todayRange.start && a.date < todayRange.end
  );

  const nextAppointments = (profile.appointments || []).filter((a) => a.date >= todayRange.end);
  const nextDayReference = nextAppointments[0]?.date || null;
  const nextDayRange = nextDayReference ? getDayRange(nextDayReference) : null;
  const nextDayAppointments = nextDayRange
    ? nextAppointments.filter((a) => a.date >= nextDayRange.start && a.date < nextDayRange.end)
    : [];

  const agendaTitle = todayAppointments.length > 0 ? "Citas de hoy" : "Próxima jornada";
  const agendaItems = todayAppointments.length > 0 ? todayAppointments : nextDayAppointments;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-800">Panel Profesional</h1>
        <p className="text-slate-500">
          Hola, <span className="font-medium text-slate-700">{profile.user?.name || "Profesional"}</span>.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{agendaTitle}</h2>
            <p className="text-sm text-slate-500">
              {todayAppointments.length > 0
                ? "Tus citas pendientes o confirmadas para hoy."
                : "Ya no hay citas para hoy; aquí ves el siguiente día con agenda."}
            </p>
          </div>
          <Link
            href="/panel/profesional/citas"
            className="text-sm inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50"
          >
            Ver agenda completa
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {agendaItems.length === 0 ? (
            <div className="px-6 py-5 text-slate-500">No hay citas programadas.</div>
          ) : (
            agendaItems.map((a) => (
              <div key={a.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-800">
                    {a.service?.title || "Servicio"} · {a.patient?.name || "Paciente"}
                  </div>
                  <div className="text-sm text-slate-500">{formatDateTime(a.date)}</div>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-slate-700 text-xs font-semibold border border-slate-200">
                  {a.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-sm text-slate-500">Servicios asignados</div>
          <div className="mt-1 text-3xl font-bold text-slate-800">{assignedServices.length}</div>
          <div className="mt-2 text-xs text-slate-500">Activos: {activeAssignedServices.length}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-sm text-slate-500">Citas (total)</div>
          <div className="mt-1 text-3xl font-bold text-slate-800">{profile._count?.appointments ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">Próximas: {profile.appointments?.length ?? 0}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-sm text-slate-500">Publicaciones</div>
          <div className="mt-1 text-3xl font-bold text-slate-800">{profile._count?.posts ?? 0}</div>
          <div className="mt-2">
            <Link
              href="/panel/profesional/editar-articulo/new"
              className="text-sm inline-flex items-center rounded-xl border border-slate-200 px-3 py-1 hover:bg-slate-50"
            >
              Crear artículo
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Perfil y servicios</h2>
            <p className="text-sm text-slate-500">Edita tus datos, solicita vinculación y actualiza precios propuestos.</p>
          </div>
          <Link href="/panel/profesional/perfil" className="text-sm inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
            Editar perfil
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Mis artículos</h2>
          <Link href="/panel/profesional/editar-articulo/new" className="text-sm inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50">
            Nuevo artículo
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {(profile.posts || []).length === 0 ? (
            <div className="px-6 py-5 text-slate-500">Aún no has publicado artículos.</div>
          ) : (
            profile.posts.map((post) => (
              <div key={post.id} className="px-6 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-800">{post.title}</div>
                  <div className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleDateString("es-CR")} · {post.status === "PUBLISHED" ? "Publicado" : "Pendiente de aprobación"}</div>
                </div>
                <Link href={`/panel/profesional/editar-articulo/${post.id}`} className="text-sm text-blue-700 hover:underline">
                  Editar
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/panel/profesional/horarios" className="text-sm inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50">
          Gestionar horarios
        </Link>
        <Link href="/panel/profesional/integraciones" className="text-sm inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50">
          Calendario e integraciones
        </Link>
      </div>
    </div>
  );
}
