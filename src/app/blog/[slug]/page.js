// src/app/blog/[slug]/page.js
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { resolveSeo, buildMetadata } from "@/lib/seo";
import BlogArticleView from "@/components/blog/BlogArticleView";

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug },
    select: {
      title: true, excerpt: true, coverImage: true, coverImageTitle: true,
      metaTitle: true, metaDescription: true, ogImage: true, noindex: true,
    },
  });

  if (!post) return { title: 'Artículo no encontrado' };

  const seo = resolveSeo(post, {
    title: post.title,
    description: post.excerpt || post.title,
    image: post.coverImage,
    imageAlt: post.coverImageTitle || post.title,
  });

  return buildMetadata({
    title: seo.title,
    description: seo.description,
    path: `blog/${slug}`,
    image: seo.image,
    imageAlt: seo.imageAlt,
    type: 'article',
    noindex: seo.noindex,
  });
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;

  const post = await prisma.post.findFirst({
    where: { slug: slug, status: 'PUBLISHED' },
    include: {
      author: {
        select: {
          id: true,
          specialty: true,
          bio: true,
          user: { select: { name: true, image: true } },
        },
      },
    },
  });

  if (!post) notFound();

  return <BlogArticleView post={post} slug={slug} />;
}
