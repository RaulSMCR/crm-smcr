import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listTopicsForAdmin } from "@/lib/topic-queries";
import { getHubData } from "@/lib/hub-raul";
import { listProfessionalHubsForAdmin } from "@/lib/professional-hub-queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_LABELS = { DRAFT: "Borrador", PUBLISHED: "Publicado", ARCHIVED: "Archivado" };

function Status({ status }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : status === "ARCHIVED" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800"}`}>{STATUS_LABELS[status] || status}</span>;
}

export default async function AdminHubsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  const [topics, professionalHubs] = await Promise.all([listTopicsForAdmin(), listProfessionalHubsForAdmin()]);
  const legacyHub = getHubData();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><Link href="/panel/admin" className="text-sm font-semibold text-slate-600 hover:underline">← Panel</Link><h1 className="mt-2 text-3xl font-bold text-slate-950">Administración de hubs</h1><p className="mt-1 max-w-3xl text-slate-600">Creá hubs de contenido y administrá sus módulos, funciones, publicaciones, relaciones y llamados a la acción.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/panel/admin/hubs/profesional/nuevo" className="rounded-lg bg-brand-800 px-4 py-2 font-bold text-white">+ Hub profesional</Link><Link href="/panel/admin/hubs/nuevo" className="rounded-lg bg-accent-500 px-4 py-2 font-bold text-accent-950">+ Hub de contenido</Link></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-brand-200 bg-brand-50 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200 px-5 py-4"><div><h2 className="text-xl font-bold text-slate-950">Hubs profesionales</h2><p className="mt-1 text-sm text-slate-700">Configuración de la experiencia pública de cada profesional.</p></div><span className="text-sm font-semibold text-brand-800">{professionalHubs.length} configurados</span></div>
          <div className="divide-y divide-brand-100">
            {professionalHubs.map((hub) => <div key={hub.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold text-slate-950">{hub.name}</h3><Status status={hub.status} /></div><p className="mt-1 text-sm text-slate-600">/{hub.slug} · {hub._count.modules} módulos{hub.professional?.user?.name ? ` · ${hub.professional.user.name}` : ""}</p></div><div className="flex items-center gap-4"><Link href={`/panel/admin/hubs/profesional/${hub.id}`} className="font-semibold text-brand-800 hover:underline">Editar hub →</Link>{hub.status === "PUBLISHED" ? <Link href={`/${hub.slug}`} target="_blank" rel="noreferrer" className="text-sm text-slate-600 hover:underline">Ver público ↗</Link> : null}</div></div>)}
            {!professionalHubs.length ? <div className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-slate-700">Todavía no hay hubs profesionales migrados.</p><Link href="/panel/admin/hubs/profesional/nuevo" className="font-semibold text-brand-800 hover:underline">Crear el primero →</Link></div> : null}
          </div>
          <div className="border-t border-brand-200 px-5 py-4 text-sm text-slate-600">Referencia editorial inicial: {legacyHub.nombre} · {legacyHub.url_hub}. La configuración operativa ya está persistida en Supabase.</div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-xl font-bold text-slate-950">Hubs de contenido</h2><p className="mt-1 text-sm text-slate-600">Hubs editoriales generales con módulos reutilizables.</p></div><div className="divide-y divide-slate-100">{topics.map((topic) => <div key={topic.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold text-slate-950">{topic.title || topic.name}</h3><Status status={topic.status} /></div><p className="mt-1 text-sm text-slate-500">/{topic.slug} · {topic._count.sections} módulos · {topic._count.posts} artículos · {topic._count.services} servicios · {topic._count.faqs} preguntas</p></div><div className="flex items-center gap-4"><Link href={`/panel/admin/hubs/${topic.id}`} className="font-semibold text-brand-800 hover:underline">Editar hub →</Link>{topic.status === "PUBLISHED" ? <Link href={`/${topic.slug}`} target="_blank" rel="noreferrer" className="text-sm text-slate-600 hover:underline">Ver público ↗</Link> : null}</div></div>)}{!topics.length ? <p className="p-6 text-slate-600">Todavía no hay hubs de contenido.</p> : null}</div></section>
      </div>
    </main>
  );
}
