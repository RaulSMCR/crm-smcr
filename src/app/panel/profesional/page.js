// src/app/panel/profesional/page.js
import { redirect } from "next/navigation";
import { getSession, logout } from "@/actions/auth-actions"; // usamos logout
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfessionalDashboard() {
  // 1. Verificación de Sesión
  const session = await getSession();

  if (!session) {
    redirect("/ingresar");
  }

  if (session.role !== "PROFESSIONAL") {
    return redirect(session.role === "ADMIN" ? "/panel/admin" : "/panel/paciente");
  }

  // 2. Consulta a Base de Datos
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: session.sub },
    include: {
      user: true,
      services: true,
      _count: {
        select: { posts: true, appointments: true },
      },
      appointments: {
        where: { date: { gte: new Date() } },
        orderBy: { date: "asc" },
        take: 5,
      },
    },
  });

  if (!profile) return <div className="p-8 text-center">Error: No se encontró el perfil.</div>;

  // 3. Serialización de fechas
  const safeAppointments = profile.appointments.map((appt) => ({
    id: appt.id,
    dateString: appt.date.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    timeString: appt.date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
  }));

  const isActive = profile.user.isActive;

  // ✅ FIX: la aprobación ya NO vive en user.isApproved; vive en professionalProfile.isApproved
  const isApproved = Boolean(profile.isApproved);

  // 4. PANTALLA DE BLOQUEO (Si no está aprobado)
  if (!isApproved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-yellow-200 text-center max-w-md">
          <span className="text-5xl">⏳</span>
          <h1 className="text-xl font-bold mt-4 text-slate-800">Perfil en Revisión</h1>
          <p className="text-slate-600 mt-2 text-sm">
            Ya verificaste tu correo: el siguiente paso es la entrevista y aprobación final.
            <br />
            Te contactará el director del equipo profesional al teléfono/WhatsApp registrado.
          </p>

          <div className="mt-6 border-t pt-4">
            <form action={logout}>
              <button type="submit" className="text-blue-600 text-sm hover:underline font-bold">
                Cerrar Sesión
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 5. DASHBOARD OPERATIVO
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* A. ENCABEZADO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Hola, {String(profile.user.name || "").split(" ")[0]} 👋
            </h1>
            <p className="text-slate-500 text-sm">Panel de Control • {profile.specialty}</p>
          </div>
          <div className="flex gap-3 items-center">
            {/* BOTÓN SALIR */}
            <form action={logout}>
              <button
                type="submit"
                className="text-red-500 text-xs font-bold border border-red-100 px-3 py-2 rounded-lg hover:bg-red-50 transition"
              >
                Salir
              </button>
            </form>

            <Link
              href={`/profesionales/${profile.slug}`}
              target="_blank"
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition flex items-center gap-2"
            >
              👁️ Ver mi Perfil Público
            </Link>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isActive
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-red-100 text-red-700 border-red-200"
              }`}
            >
              {isActive ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* B. CENTRO DE COMANDO */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/panel/profesional/perfil"
            className="group bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-300 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl text-blue-500">
              👤
            </div>
            <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              ⚙️
            </div>
            <h3 className="font-bold text-slate-800">Editar Perfil</h3>
            <p className="text-xs text-slate-500 mt-1">
              Bio, foto, precio y <strong>asignar servicios</strong>.
            </p>
          </Link>

          <Link
            href="/panel/profesional/posts"
            className="group bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-purple-300 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl text-purple-500">
              ✍️
            </div>
            <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              📝
            </div>
            <h3 className="font-bold text-slate-800">Blog y Artículos</h3>
            <p className="text-xs text-slate-500 mt-1">Gestiona tus publicaciones. ({profile._count.posts} activos)</p>
          </Link>

          <Link
            href="/panel/profesional/horarios"
            className="group bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-green-300 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl text-green-500">
              📅
            </div>
            <div className="h-12 w-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              ⏰
            </div>
            <h3 className="font-bold text-slate-800">Mis Horarios</h3>
            <p className="text-xs text-slate-500 mt-1">Define tu disponibilidad semanal para citas.</p>
          </Link>

          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase text-slate-400">Rendimiento</span>
              <span className="text-xl">⭐ {profile.rating ? Number(profile.rating).toFixed(1) : "-"}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Servicios:</span>
                <span className="font-bold">{profile.services.length}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Matrícula:</span>
                <span className="font-bold text-green-600">Verificada</span>
              </div>
            </div>
          </div>
        </div>

        {/* C. AGENDA PRÓXIMA */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">📅 Próximos Turnos</h3>
            {safeAppointments.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">
                {safeAppointments.length} pendientes
              </span>
            )}
          </div>

          {safeAppointments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🍃</div>
              <p className="text-slate-500 font-medium">Tu agenda está libre por ahora.</p>
              <p className="text-xs text-slate-400 mt-1">Asegúrate de tener tus horarios configurados.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {safeAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="p-4 hover:bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                      P
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 capitalize">{appt.dateString}</p>
                      <p className="text-sm text-slate-500">Consulta Agendada</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-lg font-bold text-blue-600">{appt.timeString} hs</span>
                    <span className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-100 font-medium">
                      Confirmada
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
