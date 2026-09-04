import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listTopicsForAdmin } from "@/lib/topic-queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_LABELS = { DRAFT: "Borrador", PUBLISHED: "Publicado", ARCHIVED: "Archivado" };

export default async function AdminTopicsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  const topics = await listTopicsForAdmin();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><Link href="/panel/admin" className="text-sm font-semibold text-slate-600 hover:underline">← Panel</Link><h1 className="mt-2 text-3xl font-bold text-slate-950">Hubs temáticos</h1><p className="mt-1 text-slate-600">Landings editoriales dinámicas de la arquitectura SEO.</p></div>
          <Link href="/panel/admin/temas/nuevo" className="rounded-lg bg-accent-500 px-4 py-2 font-bold text-accent-950">+ Nuevo hub</Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="p-4">Hub</th><th className="p-4">Estado</th><th className="p-4">Contenido</th><th className="p-4">Acción</th></tr></thead><tbody className="divide-y divide-slate-100">
            {topics.map((topic) => <tr key={topic.id}><td className="p-4"><div className="font-semibold text-slate-950">{topic.title || topic.name}</div><div className="text-sm text-slate-500">/{topic.slug}</div></td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${topic.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : topic.status === "ARCHIVED" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800"}`}>{STATUS_LABELS[topic.status] || topic.status}</span></td><td className="p-4 text-sm text-slate-600">{topic._count.posts} artículos · {topic._count.services} servicios · {topic._count.perspectives} perspectivas</td><td className="p-4"><Link href={`/panel/admin/temas/${topic.id}`} className="font-semibold text-brand-800 hover:underline">Editar →</Link>{topic.status === "PUBLISHED" ? <Link href={`/${topic.slug}`} target="_blank" className="ml-4 text-sm text-slate-600 hover:underline">Ver público</Link> : null}</td></tr>)}
            {!topics.length ? <tr><td colSpan={4} className="p-6 text-slate-600">Todavía no hay hubs.</td></tr> : null}
          </tbody></table>
        </div>
      </div>
    </main>
  );
}
