// src/app/admin/page.js
// src/app/admin/page.js
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminApproveButton from "@/components/AdminApproveButton";

export const revalidate = 0; // siempre fresco (Server Component)

function formatDateShort(date) {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return String(date);
  }
}

function formatDateTime(date) {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return String(date);
  }
}

function StatCard({ title, value, hint, href }) {
  const card = (
    <div className="rounded-2xl border bg-white p-5 hover:bg-neutral-50 transition">
      <div className="text-sm text-neutral-600">{title}</div>
      <div className="mt-1 text-3xl font-bold text-neutral-900">{value}</div>
      {hint ? <div className="mt-2 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-brand-600 rounded-2xl">
        {card}
      </Link>
    );
  }
  return card;
}

function Pill({ tone = "neutral", children }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-800",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + (tones[tone] || tones.neutral)}>
      {children}
    </span>
  );
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // =========================
  // MÉTRICAS (rápidas)
  // =========================
  const [
    usersTotal,
    professionalsTotal,

    // operativas
    professionalsPendingCount,
    professionalsUnverifiedCount,

    postsTotal,
    postsPendingCount,

    appointmentsTotal,
    appointmentsUpcomingCount,

    // actividad reciente
    usersLast7,
    professionalsLast7,
    postsLast7,
    appointmentsLast7,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.professional.count(),

    prisma.professional.count({
      where: { isApproved: false, emailVerified: true },
    }),
    prisma.professional.count({
      where: { emailVerified: false },
    }),

    prisma.post.count(),
    prisma.post.count({ where: { status: "PENDING" } }),

    prisma.appointment.count(),
    prisma.appointment.count({
      where: { startTime: { gte: now } },
    }),

    prisma.user.count({ where: { createdAt: { gte: days7 } } }),
    prisma.professional.count({ where: { createdAt: { gte: days7 } } }),
    prisma.post.count({ where: { createdAt: { gte: days7 } } }),
    prisma.appointment.count({ where: { createdAt: { gte: days7 } } }),
  ]);

  // =========================
  // LISTAS (operativas)
  // =========================

  // Profesionales pendientes (solo si email verificado)
  const pendingProfessionals = await prisma.professional.findMany({
    where: { isApproved: false, emailVerified: true },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      name: true,
      email: true,
      profession: true,
      createdAt: true,
    },
  });

  // Profesionales sin verificar (para visibilidad)
  const unverifiedProfessionals = await prisma.professional.findMany({
    where: { emailVerified: false },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      name: true,
      email: true,
      profession: true,
      createdAt: true,
    },
  });

  // Posts pendientes
  const pendingPosts = await prisma.post.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      slug: true,
      title: true,
      createdAt: true,
      postType: true,
      author: { select: { id: true, name: true, profession: true } },
      service: { select: { id: true, slug: true, title: true } },
    },
  });

  // Próximas citas (solo lectura)
  const upcomingAppointments = await prisma.appointment.findMany({
    where: { startTime: { gte: now } },
    orderBy: { startTime: "asc" },
    take: 10,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
      user: { select: { id: true, name: true, email: true } },
      professional: { select: { id: true, name: true, profession: true } },
      service: { select: { id: true, title: true, slug: true } },
    },
  });

  // =========================
  // “Alertas” simples
  // =========================
  const alerts = [];
  if (professionalsPendingCount > 0) {
    alerts.push({
      tone: "yellow",
      title: "Profesionales pendientes",
      text: `Tenés ${professionalsPendingCount} profesional(es) con email verificado listos para aprobación.`,
      href: "/admin/professionals",
      cta: "Ir a aprobaciones",
    });
  }
  if (postsPendingCount > 0) {
    alerts.push({
      tone: "blue",
      title: "Posts en revisión",
      text: `Hay ${postsPendingCount} publicación(es) esperando moderación.`,
      href: "/admin/posts",
      cta: "Revisar posts",
    });
  }
  if (professionalsUnverifiedCount > 0) {
    alerts.push({
      tone: "neutral",
      title: "Emails sin verificar",
      text: `${professionalsUnverifiedCount} profesional(es) todavía no verificaron su email (no se pueden aprobar).`,
      href: "/admin/professionals",
      cta: "Ver profesionales",
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-neutral-900">Dashboard Admin</h1>
        <p className="text-sm text-neutral-600">
          Centro de control: aprobaciones, moderación, actividad y seguimiento.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Pill tone="green">Build OK</Pill>
          <Pill tone="neutral">Datos en vivo (revalidate=0)</Pill>
        </div>
      </header>

      {/* Alertas */}
      {alerts.length ? (
        <section className="grid gap-3">
          {alerts.map((a, idx) => (
            <Link
              key={idx}
              href={a.href}
              className="rounded-2xl border bg-white p-4 hover:bg-neutral-50 transition focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Pill tone={a.tone}>{a.title}</Pill>
                  </div>
                  <p className="text-sm text-neutral-800">{a.text}</p>
                </div>
                <span className="text-sm text-brand-700 underline whitespace-nowrap">{a.cta} →</span>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-neutral-700">
            No hay alertas operativas. Todo en orden ✅
          </p>
        </section>
      )}

      {/* Métricas principales */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Usuarios" value={usersTotal} hint="Total registrados" href="/admin/users" />
        <StatCard title="Profesionales" value={professionalsTotal} hint="Total registrados" href="/admin/professionals" />
        <StatCard
          title="Pendientes de aprobación"
          value={professionalsPendingCount}
          hint="Email verificado, esperando aprobación"
          href="/admin/professionals"
        />
        <StatCard title="Posts" value={postsTotal} hint="Total en el blog" href="/admin/posts" />
        <StatCard title="Posts pendientes" value={postsPendingCount} hint="Listos para revisión" href="/admin/posts" />
        <StatCard title="Citas" value={appointmentsTotal} hint="Total en la base" href="/admin/appointments" />
      </section>

      {/* Actividad reciente */}
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Actividad (últimos 7 días)</h2>
          <Pill tone="neutral">Desde: {formatDateShort(days7)}</Pill>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-4">
            <div className="text-xs text-neutral-500">Usuarios nuevos</div>
            <div className="mt-1 text-2xl font-bold">{usersLast7}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs text-neutral-500">Profesionales nuevos</div>
            <div className="mt-1 text-2xl font-bold">{professionalsLast7}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs text-neutral-500">Posts creados</div>
            <div className="mt-1 text-2xl font-bold">{postsLast7}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs text-neutral-500">Citas creadas</div>
            <div className="mt-1 text-2xl font-bold">{appointmentsLast7}</div>
          </div>
        </div>

        <div className="text-xs text-neutral-500">
          Tip: cuando esto crezca, acá van gráficos y filtros por fecha/profesión/servicio.
        </div>
      </section>

      {/* Operación: Pendientes */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Profesionales pendientes */}
        <div className="rounded-2xl border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Profesionales listos para aprobar</h2>
            <Link href="/admin/professionals" className="text-sm text-brand-700 underline">
              Ver todo →
            </Link>
          </div>

          <p className="text-xs text-neutral-500">
            Solo muestra: <b>email verificado</b> + <b>isApproved=false</b>. (máx. 12)
          </p>

          {pendingProfessionals.length === 0 ? (
            <p className="text-sm text-neutral-700">No hay profesionales listos para aprobación.</p>
          ) : (
            <ul className="space-y-3">
              {pendingProfessionals.map((pro) => (
                <li key={pro.id} className="rounded-xl border p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/professionals/${pro.id}`}
                      className="font-medium text-brand-800 underline"
                    >
                      {pro.name}
                    </Link>
                    <div className="text-sm text-neutral-700">{pro.profession}</div>
                    <div className="text-xs text-neutral-500 truncate">{pro.email}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Alta: {formatDateShort(new Date(pro.createdAt))}
                    </div>
                  </div>

                  <AdminApproveButton
                    label="Aprobar"
                    endpoint={`/api/admin/professionals/${pro.id}/approve`}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Posts pendientes */}
        <div className="rounded-2xl border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Posts en revisión</h2>
            <Link href="/admin/posts" className="text-sm text-brand-700 underline">
              Ver todo →
            </Link>
          </div>

          {pendingPosts.length === 0 ? (
            <p className="text-sm text-neutral-700">No hay posts pendientes.</p>
          ) : (
            <ul className="space-y-3">
              {pendingPosts.map((p) => (
                <li key={p.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p.title}</div>

                      <div className="text-xs text-neutral-500 mt-1">
                        {p.author?.name ?? "—"}
                        {p.author?.profession ? ` · ${p.author.profession}` : ""}
                        {" · "}
                        <Pill tone="blue">{p.postType}</Pill>
                        {" · "}
                        {formatDateShort(new Date(p.createdAt))}
                      </div>

                      {p.service ? (
                        <div className="mt-1 text-xs text-neutral-600">
                          Servicio:{" "}
                          <Link className="text-brand-700 underline" href={`/servicios/${p.service.slug}`}>
                            {p.service.title}
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-neutral-500">Sin servicio asociado</div>
                      )}

                      <div className="mt-1 text-[11px] text-neutral-500 truncate">Slug: {p.slug}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/blog/${p.slug}`}
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
                        prefetch={false}
                        target="_blank"
                      >
                        Ver
                      </Link>

                      <AdminApproveButton
                        label="Publicar"
                        endpoint={`/api/admin/posts/${p.id}/approve`}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Próximas citas */}
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Próximas citas</h2>
          <div className="flex items-center gap-2">
            <Pill tone="neutral">{appointmentsUpcomingCount} futuras</Pill>
            <Link href="/admin/appointments" className="text-sm text-brand-700 underline">
              Ver todo →
            </Link>
          </div>
        </div>

        {upcomingAppointments.length === 0 ? (
          <p className="text-sm text-neutral-700">No hay citas futuras.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b">
                  <th className="py-2 pr-3">Inicio</th>
                  <th className="py-2 pr-3">Usuario</th>
                  <th className="py-2 pr-3">Profesional</th>
                  <th className="py-2 pr-3">Servicio</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {upcomingAppointments.map((a) => (
                  <tr key={a.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatDateTime(new Date(a.startTime))}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{a.user?.name ?? "—"}</div>
                      <div className="text-xs text-neutral-500">{a.user?.email ?? ""}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{a.professional?.name ?? "—"}</div>
                      <div className="text-xs text-neutral-500">{a.professional?.profession ?? ""}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {a.service ? (
                        <Link className="text-brand-700 underline" href={`/servicios/${a.service.slug}`}>
                          {a.service.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Pill tone={a.status === "CANCELLED" ? "red" : a.status === "CONFIRMED" ? "green" : "yellow"}>
                        {a.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-2 text-xs text-neutral-500">
              (Read-only por ahora. Luego agregamos filtros por fecha/profesional/servicio.)
            </p>
          </div>
        )}
      </section>

      {/* Profesionales sin verificar (visibilidad de “embudo”) */}
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Profesionales con email NO verificado</h2>
          <Pill tone="neutral">Últimos {unverifiedProfessionals.length}</Pill>
        </div>

        {unverifiedProfessionals.length === 0 ? (
          <p className="text-sm text-neutral-700">No hay profesionales sin verificar.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {unverifiedProfessionals.map((p) => (
              <li key={p.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{p.email}</div>
                    <div className="text-xs text-neutral-500">{p.profession}</div>
                    <div className="mt-1 text-[11px] text-neutral-500">
                      Alta: {formatDateShort(new Date(p.createdAt))}
                    </div>
                  </div>
                  <Pill tone="yellow">No verificado</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Atajos reales */}
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Atajos</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link className="rounded-xl border p-3 hover:bg-neutral-50" href="/admin/professionals">
            <p className="font-medium">Profesionales</p>
            <p className="text-xs text-neutral-600">Pendientes, aprobados, detalle</p>
          </Link>

          <Link className="rounded-xl border p-3 hover:bg-neutral-50" href="/admin/posts">
            <p className="font-medium">Posts</p>
            <p className="text-xs text-neutral-600">Revisión y publicación</p>
          </Link>

          <Link className="rounded-xl border p-3 hover:bg-neutral-50" href="/admin/appointments">
            <p className="font-medium">Citas</p>
            <p className="text-xs text-neutral-600">Agenda global (read-only)</p>
          </Link>

          <div className="rounded-xl border p-3 opacity-60">
            <p className="font-medium">Pagos</p>
            <p className="text-xs text-neutral-600">Próximamente</p>
          </div>
        </div>
      </section>

      <footer className="text-xs text-neutral-500">
        Nota: Cuando escale, esto se divide en páginas dedicadas y agregamos filtros (por fecha, profesional, servicio).
      </footer>
    </main>
  );
}
