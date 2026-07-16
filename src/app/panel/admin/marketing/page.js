import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";
import HomeCarouselManager from "@/components/admin/HomeCarouselManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAY_MS = 24 * 60 * 60 * 1000;

const CAMPAIGN_TEMPLATES = [
  {
    label: "Pacientes - busqueda",
    path: "/servicios",
    source: "google",
    medium: "cpc",
    campaign: "pacientes_servicios_salud_mental",
    content: "search_general",
  },
  {
    label: "Profesionales - captacion",
    path: "/registro/profesional",
    source: "google",
    medium: "cpc",
    campaign: "captacion_profesionales",
    content: "search_profesionales",
  },
  {
    label: "Blog - remarketing",
    path: "/blog",
    source: "meta",
    medium: "paid_social",
    campaign: "remarketing_blog_bienestar",
    content: "feed",
  },
];

function daysAgo(days) {
  return new Date(Date.now() - days * DAY_MS);
}

function countOf(row) {
  return row?._count?._all || 0;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total || 0)) * 100);
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-CR").format(Number(value || 0));
}

function formatSeconds(value) {
  const seconds = Math.round(Number(value || 0));
  if (!seconds) return "0 s";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function campaignKey(row) {
  return [row.utmSource || "sin_fuente", row.utmMedium || "sin_medio", row.utmCampaign || "sin_campana"].join("|");
}

function buildUtmUrl(path, { source, medium, campaign, content }) {
  const url = new URL(siteUrl(path));
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  if (content) url.searchParams.set("utm_content", content);
  return url.toString();
}

function groupCounts(items, getName) {
  const map = new Map();
  for (const item of items) {
    const name = getName(item) || "Sin especificar";
    map.set(name, (map.get(name) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function MetricCard({ label, value, help, tone = "brand" }) {
  const toneClass = tone === "accent" ? "text-accent-900" : "text-brand-900";

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 shadow-card">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-neutral-600">{help}</p>
    </div>
  );
}

function StatusPill({ ok, label }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
        ok
          ? "border-brand-300 bg-brand-100 text-brand-900"
          : "border-accent-300 bg-accent-100 text-accent-950"
      }`}
    >
      {label}
    </span>
  );
}

function BarList({ rows, empty = "Sin datos para este periodo.", limit = 6 }) {
  const visible = rows.slice(0, limit);
  const max = Math.max(...visible.map((row) => row.count), 1);

  if (visible.length === 0) {
    return <p className="text-sm text-neutral-600">{empty}</p>;
  }

  return (
    <div className="space-y-3">
      {visible.map((row) => (
        <div key={row.name}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-neutral-900">{row.name}</span>
            <span className="text-neutral-700">{formatNumber(row.count)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-neutral-200">
            <div className="h-full rounded bg-brand-700" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-neutral-950">{title}</h2>
      {action}
    </div>
  );
}

function UrlBox({ label, value }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">{label}</span>
      <input
        readOnly
        value={value}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800"
      />
    </label>
  );
}

export default async function AdminMarketingPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const since30 = daysAgo(30);
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
  const adsTagId =
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID ||
    process.env.GOOGLE_ADS_CUSTOMER_ID ||
    "";

  const [
    items,
    posts,
    professionals,
    postViewStats,
    postReadStats,
    postLinkedStats,
    campaignViewStats,
    campaignReadStats,
    users30,
    completedAppointments,
  ] = await Promise.all([
    prisma.homeCarouselItem.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      include: {
        post: {
          select: {
            id: true,
            title: true,
            author: { select: { user: { select: { name: true } } } },
          },
        },
        professional: {
          select: {
            id: true,
            specialty: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        updatedAt: true,
        author: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.professionalProfile.findMany({
      where: {
        isApproved: true,
        user: { is: { isActive: true } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        specialty: true,
        user: { select: { name: true } },
      },
    }),
    prisma.postViewEvent.groupBy({
      by: ["postId"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
      _avg: { timeOnPageSeconds: true, scrollDepth: true },
    }),
    prisma.postViewEvent.groupBy({
      by: ["postId"],
      where: { createdAt: { gte: since30 }, isRead: true },
      _count: { _all: true },
    }),
    prisma.postViewEvent.groupBy({
      by: ["postId"],
      where: { createdAt: { gte: since30 }, userId: { not: null } },
      _count: { _all: true },
    }),
    prisma.postViewEvent.groupBy({
      by: ["utmSource", "utmMedium", "utmCampaign"],
      where: {
        createdAt: { gte: since30 },
        OR: [{ utmSource: { not: null } }, { utmMedium: { not: null } }, { utmCampaign: { not: null } }],
      },
      _count: { _all: true },
    }),
    prisma.postViewEvent.groupBy({
      by: ["utmSource", "utmMedium", "utmCampaign"],
      where: {
        createdAt: { gte: since30 },
        isRead: true,
        OR: [{ utmSource: { not: null } }, { utmMedium: { not: null } }, { utmCampaign: { not: null } }],
      },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: since30 } },
      select: { id: true, role: true, acquisitionChannel: true, campaignName: true },
    }),
    prisma.appointment.findMany({
      where: { status: "COMPLETED", date: { gte: since30 } },
      select: { patientId: true },
    }),
  ]);

  const carouselItems = items.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label || "",
    isActive: item.isActive,
    displayOrder: item.displayOrder,
    postId: item.postId || "",
    professionalId: item.professionalId || "",
    targetName:
      item.post?.title ||
      item.professional?.user?.name ||
      "Referencia no disponible",
  }));

  const postOptions = posts.map((post) => ({
    id: post.id,
    title: post.title,
    authorName: post.author?.user?.name || "Redaccion",
  }));

  const professionalOptions = professionals.map((professional) => ({
    id: professional.id,
    name: professional.user?.name || "Profesional",
    specialty: professional.specialty || "Especialidad sin definir",
  }));

  const viewsByPost = new Map(postViewStats.map((row) => [row.postId, row]));
  const readsByPost = new Map(postReadStats.map((row) => [row.postId, countOf(row)]));
  const linkedByPost = new Map(postLinkedStats.map((row) => [row.postId, countOf(row)]));
  const featuredPostIds = new Set(items.filter((item) => item.isActive && item.postId).map((item) => item.postId));

  const assetRows = posts
    .map((post) => {
      const stats = viewsByPost.get(post.id);
      const views = countOf(stats);
      const reads = readsByPost.get(post.id) || 0;
      const linked = linkedByPost.get(post.id) || 0;
      const readRate = pct(reads, views);
      const avgTime = stats?._avg?.timeOnPageSeconds || 0;
      const avgScroll = Math.round(stats?._avg?.scrollDepth || 0);
      const isFeatured = featuredPostIds.has(post.id);
      const score = views + reads * 2 + linked * 5 + (isFeatured ? 8 : 0);
      const campaign = slugify(post.title) || "articulo_blog";

      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        authorName: post.author?.user?.name || "Redaccion",
        views,
        reads,
        linked,
        readRate,
        avgTime,
        avgScroll,
        isFeatured,
        score,
        url: buildUtmUrl(`/blog/${post.slug}`, {
          source: "google",
          medium: "cpc",
          campaign,
          content: "article_ad",
        }),
      };
    })
    .sort((a, b) => b.score - a.score || b.views - a.views)
    .slice(0, 8);

  const readCampaignMap = new Map(campaignReadStats.map((row) => [campaignKey(row), countOf(row)]));
  const leadsByCampaign = groupCounts(users30, (user) => user.campaignName).reduce((map, row) => {
    map.set(row.name, row.count);
    return map;
  }, new Map());

  const campaignRows = campaignViewStats
    .map((row) => {
      const views = countOf(row);
      const reads = readCampaignMap.get(campaignKey(row)) || 0;
      const campaign = row.utmCampaign || "Sin campana";
      return {
        key: campaignKey(row),
        source: row.utmSource || "Sin fuente",
        medium: row.utmMedium || "Sin medio",
        campaign,
        views,
        reads,
        leads: leadsByCampaign.get(campaign) || 0,
        readRate: pct(reads, views),
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  const totalViews = sum(postViewStats.map(countOf));
  const totalReads = sum(postReadStats.map(countOf));
  const linkedViews = sum(postLinkedStats.map(countOf));
  const completedPatients = new Set(completedAppointments.map((appointment) => appointment.patientId));
  const patientLeads = users30.filter((user) => user.role === "USER").length;
  const professionalLeads = users30.filter((user) => user.role === "PROFESSIONAL").length;
  const activeCarouselCount = items.filter((item) => item.isActive).length;

  const channelRows = groupCounts(users30, (user) => user.acquisitionChannel);
  const campaignLeadRows = groupCounts(users30, (user) => user.campaignName);

  const trackingItems = [
    { label: "GA4", value: gaId || "Sin configurar", ok: Boolean(gaId) },
    { label: "Meta Pixel", value: metaPixelId || "Sin configurar", ok: Boolean(metaPixelId) },
    { label: "Consent Mode", value: "Activo en produccion", ok: true },
    { label: "Google Ads conversion", value: adsTagId || "Pendiente de tag AW", ok: Boolean(adsTagId) },
  ];

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/panel/admin" className="text-sm text-neutral-500 hover:text-neutral-700">
              Panel
            </Link>
            <h1 className="mt-1 text-3xl font-bold text-brand-900">Gestion publicitaria</h1>
            <p className="text-sm text-neutral-700">
              Pauta, activos promocionables, tracking y adquisicion en una sola vista.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/panel/admin/marketing/adquisicion"
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              Adquisicion
            </Link>
            <Link
              href="/panel/admin/tareas"
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:border-brand-400"
            >
              Rutina diaria
            </Link>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Visitas blog" value={formatNumber(totalViews)} help="Eventos ultimos 30 dias" />
          <MetricCard label="Lecturas reales" value={`${formatNumber(totalReads)} (${pct(totalReads, totalViews)}%)`} help="20s + 60% scroll" />
          <MetricCard label="Registros" value={formatNumber(users30.length)} help={`${patientLeads} pacientes / ${professionalLeads} pros`} tone="accent" />
          <MetricCard label="Citas completadas" value={formatNumber(completedPatients.size)} help="Pacientes con cita completada" />
          <MetricCard label="Home activa" value={formatNumber(activeCarouselCount)} help="Piezas visibles en portada" tone="accent" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
            <SectionHeader title="Tracking y conversiones" />
            <div className="grid gap-3 sm:grid-cols-2">
              {trackingItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">{item.label}</p>
                      <p className="mt-2 break-all text-sm font-semibold text-neutral-950">{item.value}</p>
                    </div>
                    <StatusPill ok={item.ok} label={item.ok ? "OK" : "Falta"} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
            <SectionHeader title="Embudo operativo" />
            <div className="space-y-3">
              {[
                ["Visita a contenido", totalViews],
                ["Lectura calificada", totalReads],
                ["Vista vinculada a usuario", linkedViews],
                ["Registro nuevo", users30.length],
                ["Paciente con cita completada", completedPatients.size],
              ].map(([label, value], index) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                  <span className="text-sm font-semibold text-neutral-800">{index + 1}. {label}</span>
                  <span className="text-sm font-bold text-brand-900">{formatNumber(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
            <SectionHeader title="Registros por canal" />
            <BarList rows={channelRows} />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
            <SectionHeader title="Registros por campana" />
            <BarList rows={campaignLeadRows} />
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <SectionHeader
            title="Campanas UTM activas"
            action={
              <span className="text-xs font-semibold text-neutral-600">
                Ultimos 30 dias
              </span>
            }
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-[0.12em] text-neutral-500">
                <tr>
                  <th className="py-3 pr-4">Campana</th>
                  <th className="py-3 pr-4">Fuente / medio</th>
                  <th className="py-3 pr-4 text-right">Visitas</th>
                  <th className="py-3 pr-4 text-right">Lecturas</th>
                  <th className="py-3 pr-4 text-right">Registros</th>
                  <th className="py-3 text-right">Lectura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {campaignRows.map((row) => (
                  <tr key={row.key}>
                    <td className="max-w-[280px] py-3 pr-4 font-semibold text-neutral-950">
                      <span className="block truncate">{row.campaign}</span>
                    </td>
                    <td className="py-3 pr-4 text-neutral-700">{row.source} / {row.medium}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{formatNumber(row.views)}</td>
                    <td className="py-3 pr-4 text-right">{formatNumber(row.reads)}</td>
                    <td className="py-3 pr-4 text-right">{formatNumber(row.leads)}</td>
                    <td className="py-3 text-right">{row.readRate}%</td>
                  </tr>
                ))}
                {campaignRows.length === 0 ? (
                  <tr>
                    <td className="py-6 text-sm text-neutral-600" colSpan={6}>
                      Todavia no hay trafico con UTM en los ultimos 30 dias.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <SectionHeader title="URLs listas para pauta" />
          <div className="grid gap-4 lg:grid-cols-3">
            {CAMPAIGN_TEMPLATES.map((template) => (
              <div key={template.campaign} className="rounded-lg border border-neutral-200 bg-white p-4">
                <p className="font-bold text-neutral-950">{template.label}</p>
                <p className="mt-1 text-xs text-neutral-600">
                  {template.source} / {template.medium} / {template.campaign}
                </p>
                <div className="mt-3">
                  <UrlBox label="URL" value={buildUtmUrl(template.path, template)} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <SectionHeader title="Activos recomendados para pauta" />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-[0.12em] text-neutral-500">
                <tr>
                  <th className="py-3 pr-4">Articulo</th>
                  <th className="py-3 pr-4 text-right">Visitas</th>
                  <th className="py-3 pr-4 text-right">Lecturas</th>
                  <th className="py-3 pr-4 text-right">Registro</th>
                  <th className="py-3 pr-4 text-right">Tiempo</th>
                  <th className="py-3 pr-4 text-right">Scroll</th>
                  <th className="py-3">URL pauta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {assetRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[320px] py-3 pr-4">
                      <Link href={`/blog/${row.slug}`} className="font-semibold text-brand-900 hover:text-brand-700">
                        {row.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-600">
                        <span>{row.authorName}</span>
                        {row.isFeatured ? <span className="font-semibold text-brand-800">Home activo</span> : null}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold">{formatNumber(row.views)}</td>
                    <td className="py-3 pr-4 text-right">{formatNumber(row.reads)} ({row.readRate}%)</td>
                    <td className="py-3 pr-4 text-right">{formatNumber(row.linked)}</td>
                    <td className="py-3 pr-4 text-right">{formatSeconds(row.avgTime)}</td>
                    <td className="py-3 pr-4 text-right">{row.avgScroll}%</td>
                    <td className="min-w-[320px] py-3">
                      <input
                        readOnly
                        value={row.url}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800"
                      />
                    </td>
                  </tr>
                ))}
                {assetRows.length === 0 ? (
                  <tr>
                    <td className="py-6 text-sm text-neutral-600" colSpan={7}>
                      No hay articulos publicados para promocionar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <SectionHeader title="Lanzamiento diario" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              ["Tracking", gaId && metaPixelId ? "Listo" : "Revisar"],
              ["URL UTM", "Lista"],
              ["Activo", assetRows.length ? "Seleccionado" : "Pendiente"],
              ["Landing", "Servicios / blog"],
              ["Seguimiento", "Adquisicion"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-neutral-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">{label}</p>
                <p className="mt-2 text-sm font-bold text-neutral-950">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-brand-900">Promocion interna en home</h2>
            <p className="text-sm text-neutral-700">
              Piezas destacadas que apoyan la pauta cuando el usuario vuelve a la pagina principal.
            </p>
          </div>

          <HomeCarouselManager
            initialItems={carouselItems}
            posts={postOptions}
            professionals={professionalOptions}
          />
        </section>
      </div>
    </div>
  );
}
