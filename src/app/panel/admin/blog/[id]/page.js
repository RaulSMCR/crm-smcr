import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import AdminPostEditor from "@/components/admin/AdminPostEditor";
import TaxonomyPicker from "@/components/blog/TaxonomyPicker";
import CrmMetaPanel from "@/components/blog/CrmMetaPanel";
import { listActiveVocab, getPostTaxonomy } from "@/lib/blog-taxonomy-queries";

const SUGGESTED_LABELS = { DRAFT: "Borrador", READY: "Listo para publicar", ARCHIVE: "Archivar" };

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

        {taxonomy?.suggestedStatus ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            El profesional sugiere dejar este artículo como{" "}
            <span className="font-bold">{SUGGESTED_LABELS[taxonomy.suggestedStatus] || taxonomy.suggestedStatus}</span>.
            Usá los botones de estado del editor para aplicarlo.
          </div>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <TaxonomyPicker
            postId={post.id}
            mode="approve"
            vocab={vocab}
            initial={taxonomy || undefined}
          />
        </section>

        <section id="serie-articulo" className="rounded-xl border border-brand-200 bg-brand-50/40 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Orden de lectura por series</h2>
            <p className="mt-1 text-sm text-slate-600">
              Seleccioná la serie y escribí el número de parte de este artículo. No hace falta ingresar ningún ID técnico.
              Al guardarlo, queda aprobado para el ordenamiento público.
            </p>
          </div>
          <CrmMetaPanel
            postId={post.id}
            mode="approve"
            includeSeo={false}
            vocab={vocab}
            initial={taxonomy || undefined}
          />
        </section>

      </div>
    </main>
  );
}
