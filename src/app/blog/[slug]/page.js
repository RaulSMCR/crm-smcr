// src/app/blog/[slug]/page.js
import { prisma } from '@/lib/prisma';
import { notFound, permanentRedirect } from 'next/navigation';
import { resolveRedirect, TIPOS } from '@/lib/slug-redirect';
import { resolveSeo, buildMetadata } from "@/lib/seo";
import BlogArticleView from "@/components/blog/BlogArticleView";
import ArticleTaxonomy from "@/components/blog/ArticleTaxonomy";
import { TARIFA_VIGENTE } from "@/lib/service-pricing";

export const revalidate = 3600;

/**
 * Prerenderiza los artículos publicados en el build.
 *
 * Sin esto, la primera visita a cada artículo pagaba el render completo con sus
 * consultas a Prisma: medido contra producción, ~500 ms contra los ~80 ms de la
 * home, que sí estaba prerenderizada.
 *
 * `dynamicParams` queda en su valor por defecto (true) a propósito: un artículo
 * publicado después del build, o un slug viejo que necesita redirigir, se
 * resuelve en demanda igual que antes. Esto acelera lo conocido sin cerrar la
 * puerta a lo que aparezca.
 */
export async function generateStaticParams() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return posts.map(({ slug }) => ({ slug }));
}

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
          slug: true,
          specialty: true,
          licensingBody: true,
          licenseNumber: true,
          bio: true,
          isApproved: true,
          user: { select: { name: true, image: true, isActive: true } },
          // Con esto el artículo sabe si su autor acepta citas hoy. El criterio
          // es el mismo de su ficha pública: servicio activo con tarifa vigente.
          // Sin el filtro, el botón de agendar llevaría a «Agenda no disponible».
          serviceAssignments: {
            where: {
              status: "APPROVED",
              service: { is: { isActive: true } },
              rates: { some: TARIFA_VIGENTE },
            },
            select: { serviceId: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!post) {
    // Antes de dar el artículo por inexistente, ver si el slug es una URL vieja.
    // La consulta vive acá y no en el middleware: así solo la pagan las URLs que
    // ya iban a terminar en 404.
    const vigente = await resolveRedirect(TIPOS.POST, slug);
    if (vigente) permanentRedirect(`/blog/${vigente}`);
    notFound();
  }

  return (
    <>
      <BlogArticleView post={post} slug={slug} />
      <ArticleTaxonomy
        post={{ id: post.id, seriesId: post.seriesId, seriesApproved: post.seriesApproved }}
      />
    </>
  );
}
