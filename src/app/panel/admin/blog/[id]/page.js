import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import AdminPostEditor from "@/components/admin/AdminPostEditor";
import TaxonomyPicker from "@/components/blog/TaxonomyPicker";
import { listActiveVocab, getPostTaxonomy } from "@/lib/blog-taxonomy-queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminBlogEditPage({ params }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id: String(id || "") },
    include: { author: { include: { user: true } } },
  });

  if (!post) notFound();

  const [vocab, taxonomy] = await Promise.all([listActiveVocab(), getPostTaxonomy(post.id)]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/panel/admin/blog" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
            ← Gestión editorial
          </Link>
          <Link
            href={`/blog/preview/${post.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-brand-400"
          >
            Vista previa en la página ↗
          </Link>
        </div>
        <AdminPostEditor post={post} />

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <TaxonomyPicker
            postId={post.id}
            mode="approve"
            vocab={vocab}
            initial={taxonomy || undefined}
          />
        </section>
      </div>
    </main>
  );
}
