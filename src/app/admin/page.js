// src/app/admin/page.js
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminApproveButton from "@/components/AdminApproveButton";

function formatDate(date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export const revalidate = 0; // mostrar siempre datos frescos

export default async function AdminPage() {
  // =========================
  // MÉTRICAS RÁPIDAS
  // =========================
  const [
    usersTotal,
    professionalsTotal,
    professionalsPendingCount,
    postsTotal,
    postsPendingCount,
    appointmentsTotal,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.professional.count(),
    prisma.professional.count({
      where: { isApproved: false, emailVerified: true },
    }),
    prisma.post.count(),
    prisma.post.count({ where: { status: "PENDING" } }),
    prisma.appointment.count(),
  ]);

  // =========================
  // LISTAS OPERATIVAS
  // =========================

  // Profesionales pendientes (recomendado: emailVerified=true)
  const pendingProfessionals = await prisma.professional.findMany({
    where: { isApproved: false, emailVerified: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      profession: true,
      createdAt: true,
    },
  });

  // Posts pendientes (status = 'PENDING')
  const pendingPosts = await prisma.post.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
        <p className="text-sm text-neutral-600">
          Resumen operativo: aprobaciones, moderación y actividad reciente.
        </p>
      </header>

      {/* =========================
          MÉTRICAS
      ========================= */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-neutral-600">Usuarios</div>
          <div className="mt-1 text-3xl font-bold">{usersTotal}</div>
          <div className="mt-2 text-xs text-neutral-500">Total registrados</div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-neutral-600">Profesionales</div>
          <div className="mt-1 text-3xl font-bold">{professionalsTotal}</div>
          <div className="mt-2 text-xs text-neutral-500">Total registrados</div>
        </div>

        <Link href="/admin/professionals" className="block">
          <div className="rounded-2xl border bg-white p-5 hover:bg-neutral-50 transition">
            <div className="text-sm text-neutral-600">Pendientes de aprobación</div>
            <div className="mt-1 text-3xl font-bold">{professionalsPendingCount}</div>
            <div className="mt-2 text-xs text-neutral-500">
              Email verificado, esperando aprobación
            </div>
          </div>
        </Link>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-neutral-600">Citas</div>
          <div className="mt-1 text-3xl font-bold">{appointmentsTotal}</div>
          <div className="mt-2 text-xs text-neutral-500">Total en la base</div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-neutral-600">Posts</div>
          <div className="mt-1 text-3xl font-bold">{postsTotal}</div>
          <div className="mt-2 text-xs text-neutral-500">Total en el blog</div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-neutral-600">Posts pendientes</div>
          <div className="mt-1 text-3xl font-bold">{postsPendingCount}</div>
          <div className="mt-2 text-xs text-neutral-500">Listos para revisión</div>
        </div>
      </section>

      {/* =========================
          PROFESIONALES PENDIENTES
      ========================= */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Profesionales en espera</h2>
          <span className="text-sm text-brand-300">
            {pendingProfessionals.length} pendiente(s)
          </span>
        </div>

        <p className="mb-4 text-xs text-neutral-500">
          Solo se muestran profesionales con <b>email verificado</b> y <b>sin aprobar</b>.
        </p>

        {pendingProfessionals.length === 0 ? (
          <p className="text-brand-600">No hay profesionales para aprobar.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {pendingProfessionals.map((pro) => (
              <li
                key={pro.id}
                className="flex items-start justify-between gap-4 rounded-lg border bg-white p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/professionals/${pro.id}`}
                    className="font-medium text-brand-800 underline"
                  >
                    {pro.name}
                  </Link>

                  <div className="text-sm text-brand-600">{pro.profession}</div>
                  <div className="text-sm text-brand-300 truncate">{pro.email}</div>
                  <div className="mt-1 text-xs text-brand-300">
                    Alta: {formatDate(new Date(pro.createdAt))}
                  </div>
                </div>

                <AdminApproveButton
                  label="Aprobar profesional"
                  endpoint={`/api/admin/professionals/${pro.id}/approve`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* =========================
          POSTS PENDIENTES
      ========================= */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Artículos en revisión</h2>
          <span className="text-sm text-brand-300">
            {pendingPosts.length} pendiente(s)
          </span>
        </div>

        {pendingPosts.length === 0 ? (
          <p className="text-brand-600">No hay artículos para publicar.</p>
        ) : (
          <ul className="space-y-4">
            {pendingPosts.map((p) => (
              <li key={p.id} className="rounded-lg border bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.title}</div>

                    <div className="text-sm text-brand-600">
                      Autor: {p.author?.name ?? "—"}
                      {p.author?.profession ? ` · ${p.author.profession}` : ""}
                      {" · "}
                      {p.postType}
                      {" · "}
                      {formatDate(new Date(p.createdAt))}
                    </div>

                    {p.service ? (
                      <div className="text-sm">
                        Servicio:{" "}
                        <Link
                          className="text-brand-600 underline"
                          href={`/servicios/${p.service.slug}`}
                        >
                          {p.service.title}
                        </Link>
                      </div>
                    ) : null}

                    <div className="mt-1 text-xs text-brand-600">Slug: {p.slug}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/blog/${p.slug}`}
                      className="rounded border px-3 py-2 text-sm hover:bg-accent-300"
                      prefetch={false}
                      target="_blank"
                    >
                      Previsualizar
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
      </section>

      {/* =========================
          ATAJOS (placeholder para próximos módulos)
      ========================= */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Atajos</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link className="rounded-xl border p-3 hover:bg-neutral-50" href="/admin/professionals">
            <p className="font-medium">Aprobar profesionales</p>
            <p className="text-xs text-neutral-600">Pendientes por validar</p>
          </Link>

          <div className="rounded-xl border p-3 opacity-60">
            <p className="font-medium">Calendarios</p>
            <p className="text-xs text-neutral-600">Próximamente</p>
          </div>

          <div className="rounded-xl border p-3 opacity-60">
            <p className="font-medium">Pagos & facturación</p>
            <p className="text-xs text-neutral-600">Próximamente</p>
          </div>

          <div className="rounded-xl border p-3 opacity-60">
            <p className="font-medium">Estadísticas</p>
            <p className="text-xs text-neutral-600">Próximamente</p>
          </div>
        </div>
      </section>
    </main>
  );
}
