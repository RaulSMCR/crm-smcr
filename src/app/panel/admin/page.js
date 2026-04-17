import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import PendingProfessionalsList from "@/components/admin/PendingProfessionalsList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function DashboardCard({ href, title, description, count, tone = "brand" }) {
  const tones = {
    brand: {
      border: "hover:border-brand-400",
      badge: "bg-brand-100 text-brand-900",
      title: "group-hover:text-brand-800",
    },
    accent: {
      border: "hover:border-accent-400",
      badge: "bg-accent-100 text-accent-950",
      title: "group-hover:text-accent-900",
    },
  };

  const current = tones[tone];

  return (
    <Link
      href={href}
      className={`group rounded-2xl border border-neutral-300 bg-neutral-50 p-6 shadow-card transition-all ${current.border}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="rounded-xl bg-appbg px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-neutral-800">
          Módulo
        </div>
        {count !== undefined ? (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${current.badge}`}>{count}</span>
        ) : null}
      </div>
      <h3 className={`font-bold text-neutral-950 transition-colors ${current.title}`}>{title}</h3>
      <p className="mt-1 text-xs text-neutral-700">{description}</p>
    </Link>
  );
}

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const wherePendingProsUsers = {
    role: "PROFESSIONAL",
    professionalProfile: { is: { isApproved: false } },
  };

  const whereApprovedProsUsers = {
    role: "PROFESSIONAL",
    professionalProfile: { is: { isApproved: true } },
  };

  const [
    pendingCount,
    postsPendingCount,
    servicesCount,
    professionalsCount,
    activeAppointmentsCount,
    pendingUsers,
  ] = await Promise.all([
    prisma.user.count({ where: wherePendingProsUsers }),
    prisma.post.count({ where: { status: "DRAFT" } }),
    prisma.service.count({ where: { isActive: true } }),
    prisma.user.count({ where: whereApprovedProsUsers }),
    prisma.appointment.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.user.findMany({
      where: wherePendingProsUsers,
      include: { professionalProfile: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-appbg p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-brand-900">Panel de administración</h1>
            <p className="text-sm text-neutral-700">Torre de control del sistema.</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://am1.myprofessionalmail.com/appsuite/#!!&app=io.ox/mail&folder=default0/INBOX"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-800 shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
                <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
              </svg>
              contacto@saludmentalcostarica.com
            </a>
            <span className="rounded-full border border-brand-300 bg-brand-100 px-3 py-1 text-xs font-bold text-brand-950">
              Modo administrador
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <DashboardCard
            href="/panel/admin/servicios"
            title="Servicios"
            description="Catálogo de terapias y banner principal."
            count={servicesCount}
          />
          <DashboardCard
            href="/panel/admin/blog"
            title="Editorial"
            description="Revisión de publicaciones profesionales."
            count={postsPendingCount}
            tone="accent"
          />
          <DashboardCard
            href="/panel/admin/personal"
            title="Personal"
            description="Directorio de profesionales y vínculos."
            count={professionalsCount}
          />
          <DashboardCard
            href="/panel/admin/contabilidad"
            title="Contabilidad"
            description="Ingresos, reportes y facturación."
            tone="accent"
          />
          <DashboardCard
            href="/panel/admin/citas"
            title="Citas"
            description="Seguimiento operativo de la agenda."
            count={activeAppointmentsCount}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-brand-900">Solicitudes de ingreso</h2>
            {pendingCount > 0 ? (
              <span className="rounded-full bg-accent-800 px-2.5 py-0.5 text-xs font-bold text-white">
                {pendingCount} pendientes
              </span>
            ) : (
              <span className="text-sm text-neutral-600">(Todo al día)</span>
            )}
          </div>

          <PendingProfessionalsList users={pendingUsers} />
        </div>
      </div>
    </div>
  );
}
