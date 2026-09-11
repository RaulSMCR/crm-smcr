import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listTopicsForAdmin } from "@/lib/topic-queries";
import { getHubData } from "@/lib/hub-raul";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_LABELS = { DRAFT: "Borrador", PUBLISHED: "Publicado", ARCHIVED: "Archivado" };

function Status({ status }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : status === "ARCHIVED" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default async function AdminHubsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const [topics, raulHub] = await Promise.all([listTopicsForAdmin(), Promise.resolve(getHubData())]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/panel/admin" className="text-sm font-semibold text-slate-600 hover:underline">← Panel</Link>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Administración de hubs</h1>
            <p className="mt-1 max-w-3xl text-slate-600">Creá hubs de contenido y administrá sus módulos: tipo de función, texto, orden, visibilidad, artículos, servicios, perspectivas y preguntas frecuentes.</p>
          </div>
          <Link href="/panel/admin/hubs/nuevo" className="rounded-lg bg-accent-500 px-4 py-2 font-bold text-accent-950">+ Crear hub</Link>
        </div>

        <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Hub profesional</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{raulHub.nombre}</h2>
              <p className="mt-1 text-sm text-slate-700">{raulHub.url_hub} · {raulHub.temas.length} temas configurados · {raulHub.herramientas_habilitadas.length} herramientas habilitadas</p>
              <p className="mt-3 max-w-3xl text-sm text-slate-600">Este hub sigue usando su configuración editorial actual. La administración persistente de hubs profesionales requiere una migración propia para no guardar cambios en el sistema de archivos efímero de Vercel.</p>
            </div>
            <Link href={raulHub.url_hub} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-700 hover:underline">Ver hub ↗</Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-xl font-bold text-slate-950">Hubs de contenido</h2>
            <p className="mt-1 text-sm text-slate-600">Estos hubs se guardan en la base de datos y ya cuentan con editor de módulos.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {topics.map((topic) => (
              <div key={topic.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold text-slate-950">{topic.title || topic.name}</h3>
                    <Status status={topic.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">/{topic.slug} · {topic._count.sections} módulos · {topic._count.posts} artículos · {topic._count.services} servicios · {topic._count.faqs} preguntas</p>
                </div>
                <div className="flex items-center gap-4">
                  <Link href={`/panel/admin/hubs/${topic.id}`} className="font-semibold text-brand-800 hover:underline">Editar hub →</Link>
                  {topic.status === "PUBLISHED" ? <Link href={`/${topic.slug}`} target="_blank" rel="noreferrer" className="text-sm text-slate-600 hover:underline">Ver público ↗</Link> : null}
                </div>
              </div>
            ))}
            {!topics.length ? <p className="p-6 text-slate-600">Todavía no hay hubs de contenido.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
