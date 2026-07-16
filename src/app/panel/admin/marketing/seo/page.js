import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { resolveSeo, auditItem, SEO_LIMITS } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATIC_INDEXABLE = [
  "/", "/servicios", "/blog", "/nosotros", "/faq",
  "/registro", "/registro/profesional", "/terminos", "/privacidad", "/cookies",
];

// ---------------------------------------------------------------------------
// Presentacional (calca el patrón del panel de marketing)
// ---------------------------------------------------------------------------
function MetricCard({ label, value, tone = "brand", hint }) {
  const toneClass = tone === "accent" ? "text-accent-700" : tone === "danger" ? "text-rose-700" : "text-brand-700";
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 shadow-card">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}

function LevelDot({ level, label }) {
  const map = {
    ok: "bg-emerald-500",
    warn: "bg-amber-500",
    error: "bg-rose-500",
  };
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-600" title={label}>
      <span className={`h-2 w-2 rounded-full ${map[level] || "bg-neutral-300"}`} />
      {label}
    </span>
  );
}

function issueOf(audit, code) {
  return audit.issues.find((i) => i.code === code);
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default async function AdminSeoPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  let posts = [], services = [], professionals = [];
  try {
    [posts, services, professionals] = await Promise.all([
      prisma.post.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true, title: true, slug: true, excerpt: true, coverImage: true, content: true,
          metaTitle: true, metaDescription: true, ogImage: true, focusKeyword: true, noindex: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.service.findMany({
        where: { isActive: true },
        select: {
          id: true, title: true, description: true, bannerImage: true,
          metaTitle: true, metaDescription: true, ogImage: true, focusKeyword: true, noindex: true,
        },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.professionalProfile.findMany({
        where: { isApproved: true },
        select: {
          id: true, slug: true, specialty: true, bio: true, profileReview: true,
          metaTitle: true, metaDescription: true, ogImage: true, focusKeyword: true, noindex: true,
          user: { select: { name: true, image: true } },
        },
      }),
    ]);
  } catch {
    // Si la DB no responde, la página se renderiza vacía en vez de romper.
  }

  // Construir una lista uniforme de piezas auditables
  const items = [
    ...posts.map((p) => {
      const seo = resolveSeo(p, { title: p.title, description: p.excerpt || p.title, image: p.coverImage });
      return {
        kind: "Blog",
        label: p.title,
        editHref: `/panel/admin/blog/${p.id}`,
        publicHref: `/blog/${p.slug}`,
        audit: auditItem({ ...seo, excerpt: p.excerpt, focusKeyword: p.focusKeyword, bodyText: p.content }),
      };
    }),
    ...services.map((s) => {
      const seo = resolveSeo(s, { title: s.title, description: s.description || "", image: s.bannerImage });
      return {
        kind: "Servicio",
        label: s.title,
        editHref: `/panel/admin/servicios/${s.id}`,
        publicHref: `/servicios/${s.id}`,
        audit: auditItem({ ...seo, excerpt: s.description, focusKeyword: s.focusKeyword, bodyText: s.description }),
      };
    }),
    ...professionals.map((pro) => {
      const name = pro.user?.name || "Profesional";
      const seo = resolveSeo(pro, {
        title: `${name} | Perfil profesional`,
        description: pro.profileReview || `${name}, especialista en ${pro.specialty || "salud mental"}.`,
        image: pro.user?.image,
      });
      return {
        kind: "Perfil",
        label: name,
        // No hay editor admin de perfiles: el profesional edita su propio SEO.
        editHref: pro.slug ? `/profesionales/${pro.slug}` : null,
        publicHref: pro.slug ? `/profesionales/${pro.slug}` : null,
        audit: auditItem({ ...seo, excerpt: pro.bio, focusKeyword: pro.focusKeyword, bodyText: `${pro.bio || ""} ${pro.profileReview || ""}` }),
        noindex: pro.noindex,
      };
    }),
  ];

  // Métricas de salud técnica
  const indexableStatic = STATIC_INDEXABLE.length;
  const indexableDynamic = items.filter((i) => !issueOf(i.audit, "noindex")).length;
  const withProblems = items.filter((i) => !i.audit.ok).length;
  const noindexCount = items.filter((i) => issueOf(i.audit, "noindex")).length;
  const noDescription = items.filter((i) => issueOf(i.audit, "description")?.level === "error").length;
  const noKeyword = items.filter((i) => {
    const k = issueOf(i.audit, "keyword");
    return k && k.level !== "ok";
  }).length;

  // Títulos duplicados (efectivos)
  const titleCounts = new Map();
  items.forEach((i) => {
    const t = i.label.trim().toLowerCase();
    titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
  });
  const duplicateTitles = [...titleCounts.values()].filter((n) => n > 1).length;

  // Cola de trabajo: lo peor primero
  const queue = [...items].filter((i) => !i.audit.ok).sort((a, b) => b.audit.severity - a.audit.severity);

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Marketing</div>
              <h1 className="mt-1 text-2xl font-bold text-neutral-950">Rutina diaria de SEO</h1>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Estado on-page de todo el contenido publicado. Rango recomendado: título {SEO_LIMITS.title.min}–{SEO_LIMITS.title.max},
                descripción {SEO_LIMITS.description.min}–{SEO_LIMITS.description.max} caracteres. Empezá por la cola de trabajo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/panel/admin/marketing" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                ← Marketing
              </Link>
              <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                Ver sitemap.xml
              </a>
              <a href="/robots.txt" target="_blank" rel="noreferrer" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                Ver robots.txt
              </a>
            </div>
          </div>
        </section>

        {/* Salud técnica */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-neutral-950">Salud técnica</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="URLs en sitemap" value={indexableStatic + indexableDynamic} hint={`${indexableStatic} estáticas + ${indexableDynamic} dinámicas`} />
            <MetricCard label="Con problemas" value={withProblems} tone={withProblems ? "danger" : "brand"} hint="piezas con avisos" />
            <MetricCard label="No indexables" value={noindexCount} tone="accent" hint="marcadas noindex" />
            <MetricCard label="Sin meta desc." value={noDescription} tone={noDescription ? "danger" : "brand"} />
            <MetricCard label="Sin palabra clave" value={noKeyword} tone="accent" />
            <MetricCard label="Títulos duplicados" value={duplicateTitles} tone={duplicateTitles ? "danger" : "brand"} />
          </div>
        </section>

        {/* Cola de trabajo diaria */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-950">Cola de trabajo — lo peor primero</h2>
            <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-bold text-neutral-600">
              {queue.length} pendientes
            </span>
          </div>
          {queue.length === 0 ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Todo el contenido publicado pasa los chequeos on-page. 🎉
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {queue.slice(0, 15).map((item, idx) => (
                <li key={`${item.kind}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">{item.kind}</span>
                      <span className="truncate text-sm font-semibold text-neutral-900">{item.label}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {item.audit.issues.filter((i) => i.level !== "ok").map((i) => (
                        <LevelDot key={i.code} level={i.level} label={i.label} />
                      ))}
                    </div>
                  </div>
                  {item.editHref ? (
                    <Link href={item.editHref} className="shrink-0 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800">
                      {item.kind === "Perfil" ? "Ver perfil" : "Editar SEO"}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {queue.length > 15 ? (
            <p className="mt-3 text-xs text-neutral-500">Mostrando los 15 más críticos de {queue.length}. Revisá el detalle completo abajo.</p>
          ) : null}
        </section>

        {/* Auditoría on-page completa */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <h2 className="text-lg font-bold text-neutral-950">Auditoría on-page completa</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs uppercase tracking-[0.12em] text-neutral-500">
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Contenido</th>
                  <th className="py-2 pr-4">Título</th>
                  <th className="py-2 pr-4">Descripción</th>
                  <th className="py-2 pr-4">Extracto</th>
                  <th className="py-2 pr-4">Imagen</th>
                  <th className="py-2 pr-4">Palabra clave</th>
                  <th className="py-2 pr-4">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {items.map((item, idx) => (
                  <tr key={`${item.kind}-row-${idx}`} className={item.audit.ok ? "" : "bg-amber-50/40"}>
                    <td className="py-2 pr-4 text-xs font-bold uppercase text-neutral-500">{item.kind}</td>
                    <td className="max-w-[220px] truncate py-2 pr-4 font-medium text-neutral-900">
                      {item.publicHref ? (
                        <a href={item.publicHref} target="_blank" rel="noreferrer" className="hover:underline">{item.label}</a>
                      ) : item.label}
                    </td>
                    <td className="py-2 pr-4"><LevelDot level={issueOf(item.audit, "title").level} label={issueOf(item.audit, "title").label} /></td>
                    <td className="py-2 pr-4"><LevelDot level={issueOf(item.audit, "description").level} label={issueOf(item.audit, "description").label} /></td>
                    <td className="py-2 pr-4"><LevelDot level={issueOf(item.audit, "excerpt").level} label={issueOf(item.audit, "excerpt").label} /></td>
                    <td className="py-2 pr-4"><LevelDot level={issueOf(item.audit, "image").level} label={issueOf(item.audit, "image").label} /></td>
                    <td className="py-2 pr-4"><LevelDot level={issueOf(item.audit, "keyword").level} label={issueOf(item.audit, "keyword").label} /></td>
                    <td className="py-2 pr-4">
                      {item.editHref ? (
                        <Link href={item.editHref} className="text-xs font-semibold text-brand-700 hover:underline">
                          {item.kind === "Perfil" ? "Ver" : "Editar"}
                        </Link>
                      ) : <span className="text-xs text-neutral-400">—</span>}
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr><td colSpan={8} className="py-6 text-center text-sm text-neutral-500">No hay contenido publicado para auditar.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
