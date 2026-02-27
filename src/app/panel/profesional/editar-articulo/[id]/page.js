import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
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
    where: { userId: String(session.sub) },
    select: { id: true },
  });

  if (!profile?.id) redirect("/panel/profesional/perfil");

  const idParam = params?.id;
  if (!idParam) notFound();

  const post = await getPostOrNull(idParam, profile.id);
  if (idParam !== "new" && !post) notFound();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/panel/profesional" className="text-sm text-blue-600 underline">
          ← Volver al panel
        </Link>
      </div>

      <PostEditor initial={post} />
    </main>
  );
}
