import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTopicForAdmin, listTopicEditorOptions } from "@/lib/topic-queries";
import TopicHubEditor from "@/components/admin/TopicHubEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function serializeTopic(topic) {
  return {
    id: topic.id, name: topic.name, slug: topic.slug, title: topic.title, subtitle: topic.subtitle,
    excerpt: topic.excerpt, status: topic.status, heroImage: topic.heroImage, heroImageAlt: topic.heroImageAlt,
    introVideoUrl: topic.introVideoUrl, podcastUrl: topic.podcastUrl, metaTitle: topic.metaTitle,
    metaDescription: topic.metaDescription, featured: topic.featured, order: topic.order,
    sections: topic.sections.map(({ id, topicId, type, title, body, position, isVisible }) => ({ id, topicId, type, title, body, position, isVisible })),
    posts: topic.posts.map((item) => ({ postId: item.postId, topicId: item.topicId, role: item.role, featured: item.featured, position: item.position, post: item.post })),
    services: topic.services.map((item) => ({ topicId: item.topicId, serviceId: item.serviceId, featured: item.featured, position: item.position, service: item.service })),
    perspectives: topic.perspectives.map(({ id, topicId, disciplineId, title, content, position, status, discipline }) => ({ id, topicId, disciplineId, title, content, position, status, discipline })),
    faqs: topic.faqs.map(({ id, topicId, question, answer, position, isVisible }) => ({ id, topicId, question, answer, position, isVisible })),
    relationsFrom: topic.relationsFrom.map(({ id, targetTopic }) => ({ id, targetTopic })),
    relationsTo: topic.relationsTo.map(({ id, sourceTopic }) => ({ id, sourceTopic })),
  };
}

export default async function EditTopicPage({ params }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  const { id } = await params;
  const topic = await getTopicForAdmin(id);
  if (!topic) notFound();
  const options = await listTopicEditorOptions();
  const safeTopic = serializeTopic(topic);
  return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/panel/admin/temas" className="text-sm font-semibold text-slate-600 hover:underline">← Hubs temáticos</Link><div className="flex gap-3"><Link href={`/panel/admin/temas/${topic.id}/preview`} target="_blank" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">Vista previa ↗</Link>{topic.status === "PUBLISHED" ? <Link href={`/${topic.slug}`} target="_blank" className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white">Ver público ↗</Link> : null}</div></div><div><h1 className="text-3xl font-bold text-slate-950">{topic.title || topic.name}</h1><p className="mt-1 text-slate-600">/{topic.slug} · {topic.status}</p></div><TopicHubEditor topic={safeTopic} options={options} /></div></main>;
}
