import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import BlogArticleView from "@/components/blog/BlogArticleView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BlogPreviewPage({ params }) {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id: String(id || "") },
    include: {
      author: {
        select: { id: true, specialty: true, bio: true, user: { select: { name: true, image: true } } },
      },
    },
  });
  if (!post) notFound();

  const isAdmin = session.role === "ADMIN";
  const isAuthor = session.professionalProfile?.id && session.professionalProfile.id === post.author?.id;
  if (!isAdmin && !isAuthor) notFound();

  const backHref = isAdmin
    ? `/panel/admin/blog/${post.id}`
    : `/panel/profesional/editar-articulo/${post.id}`;

  return (
    <div>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900">
        <span className="font-semibold">
          Vista previa — {post.status === "PUBLISHED" ? "publicado" : "borrador (no visible al público)"}
        </span>
        <Link href={backHref} className="font-semibold underline">
          ← Volver al editor
        </Link>
      </div>
      <BlogArticleView post={post} slug={post.slug} preview />
    </div>
  );
}
