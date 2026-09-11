import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProfessionalHubForAdmin, listProfessionalHubOptions } from "@/lib/professional-hub-queries";
import ProfessionalHubEditor from "@/components/admin/ProfessionalHubEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function serializeHub(hub) {
  return {
    id: hub.id,
    name: hub.name,
    slug: hub.slug,
    title: hub.title,
    description: hub.description,
    profileSlug: hub.profileSlug,
    whatsapp: hub.whatsapp,
    modality: hub.modality,
    durationMin: hub.durationMin,
    featuredSeriesSlug: hub.featuredSeriesSlug,
    heroVideoUrl: hub.heroVideoUrl,
    heroPosterUrl: hub.heroPosterUrl,
    logoUrl: hub.logoUrl,
    enabledFunctions: Array.isArray(hub.enabledFunctions) ? hub.enabledFunctions : [],
    status: hub.status,
    modules: hub.modules.map((module) => ({
      id: module.id,
      hubId: module.hubId,
      slug: module.slug,
      type: module.type,
      title: module.title,
      summary: module.summary,
      body: module.body,
      metadata: module.metadata,
      position: module.position,
      isVisible: module.isVisible,
      isPublished: module.isPublished,
    })),
  };
}

export default async function EditProfessionalHubPage({ params }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  const { id } = await params;
  const [hub, profiles] = await Promise.all([getProfessionalHubForAdmin(id), listProfessionalHubOptions()]);
  if (!hub) notFound();
  return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-6xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/panel/admin/hubs" className="text-sm font-semibold text-slate-600 hover:underline">← Administración de hubs</Link>{hub.status === "PUBLISHED" ? <Link href={`/${hub.slug}`} target="_blank" rel="noreferrer" className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white">Ver público ↗</Link> : null}</div><div><h1 className="text-3xl font-bold text-slate-950">Editar hub profesional: {hub.name}</h1><p className="mt-1 text-slate-600">/{hub.slug} · {hub.status}</p></div><ProfessionalHubEditor hub={serializeHub(hub)} profiles={profiles} /></div></main>;
}
