import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildMetadata, resolveSeo } from "@/lib/seo";
import { resolveRedirect, TIPOS } from "@/lib/slug-redirect";
import { getPublishedTopicBySlug } from "@/lib/topic-queries";
import TopicHubView from "@/components/topic/TopicHubView";

export const revalidate = 3600;

export async function generateStaticParams() {
  const topics = await prisma.topic.findMany({
    where: { status: "PUBLISHED", isActive: true },
    select: { slug: true },
  });
  return topics.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const topic = await prisma.topic.findUnique({
    where: { slug: String(slug || "") },
    select: {
      name: true,
      title: true,
      excerpt: true,
      heroImage: true,
      heroImageAlt: true,
      metaTitle: true,
      metaDescription: true,
      status: true,
      isActive: true,
    },
  });

  if (!topic) return { title: "Tema no encontrado", robots: { index: false, follow: false } };
  const published = topic.status === "PUBLISHED" && topic.isActive;
  const seo = resolveSeo(topic, {
    title: topic.title || topic.name,
    description: topic.excerpt || topic.title || topic.name,
    image: topic.heroImage,
    imageAlt: topic.heroImageAlt || topic.title || topic.name,
  });

  return buildMetadata({
    title: seo.title,
    description: seo.description,
    path: slug,
    image: seo.image,
    imageAlt: seo.imageAlt,
    noindex: !published || seo.noindex,
  });
}

export default async function TopicPage({ params }) {
  const { slug } = await params;
  const topic = await getPublishedTopicBySlug(slug);
  if (!topic) {
    const current = await prisma.topic.findUnique({ where: { slug: String(slug || "") }, select: { status: true } });
    if (!current) {
      const redirectSlug = await resolveRedirect(TIPOS.TOPIC, slug);
      if (redirectSlug) permanentRedirect(`/${redirectSlug}`);
    }
    notFound();
  }

  return <TopicHubView topic={topic} />;
}
