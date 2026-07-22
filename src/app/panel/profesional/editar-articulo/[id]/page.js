import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, professionalProfileWhere } from "@/lib/auth";
import PostEditor from "@/components/PostEditor";

export const dynamic = "force-dynamic";

async function getPostOrNull(idParam, authorId) {
  if (!idParam || idParam === "new" || idParam === "nuevo") return null;

  return prisma.post.findFirst({
    where: { id: String(idParam), authorId: String(authorId) },
    select: {
      id: true,
      title: true,
      content: true,
      coverImage: true,
      coverImageTitle: true,
      coverImageAuthor: true,
      coverImageNote: true,
      status: true,
      slug: true,
      createdAt: true,
    },
  });
}

export default async function EditarArticuloPage({ params }) {
  const session = await getSession();
  if (!session?.sub || session.role !== "PROFESSIONAL") redirect("/ingresar");

  const profile = await prisma.professionalProfile.findUnique({
    where: professionalProfileWhere(session),
    select: { id: true },
  });

  if (!profile?.id) redirect("/panel/profesional/perfil");

  const { id: idParam } = await params;
  if (!idParam) notFound();

  const post = await getPostOrNull(idParam, profile.id);
  if (idParam !== "new" && !post) notFound();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/panel/profesional" className="text-sm text-blue-600 underline">
          ← Volver al panel
        </Link>
        {post ? (
          <a
            href={`/blog/preview/${post.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-blue-400"
          >
            Vista previa ↗
          </a>
        ) : null}
      </div>

      <PostEditor initial={post} />
    </main>
  );
}
