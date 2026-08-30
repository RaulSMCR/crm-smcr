import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, professionalProfileWhere } from "@/lib/auth";
import PostEditor from "@/components/PostEditor";
import TaxonomyPicker from "@/components/blog/TaxonomyPicker";
import CrmMetaPanel from "@/components/blog/CrmMetaPanel";
import { listActiveVocab, getPostTaxonomy } from "@/lib/blog-taxonomy-queries";

export const dynamic = "force-dynamic";

async function getPostOrNull(idParam, authorId) {
  if (!idParam || idParam === "new" || idParam === "nuevo") return null;

  return prisma.post.findFirst({
    where: { id: String(idParam), authorId: String(authorId) },
    select: {
      id: true,
      title: true,
      content: true,
      excerpt: true,
      coverImage: true,
      coverImageTitle: true,
      // Sin esto el editor arrancaba con el alt vacío y el PATCH lo escribía
      // como null: cada edición del profesional borraba el texto alternativo de
      // su portada, que es lo único que tiene quien no puede ver la imagen.
      coverImageAlt: true,
      coverImageAuthor: true,
      coverImageNote: true,
      extractiveBlock: true,
      status: true,
      slug: true,
      metaTitle: true,
      metaDescription: true,
      ogImage: true,
      focusKeyword: true,
      noindex: true,
      createdAt: true,
    },
  });
}

export default async function EditarArticuloPage({ params }) {
  const session = await getSession();
  if (!session?.sub || session.role !== "PROFESSIONAL") redirect("/ingresar");

  const profile = await prisma.professionalProfile.findUnique({
    where: professionalProfileWhere(session),
    select: { id: true, specialty: true },
  });

  if (!profile?.id) redirect("/panel/profesional/perfil");

  const { id: idParam } = await params;
  if (!idParam) notFound();

  const post = await getPostOrNull(idParam, profile.id);
  if (idParam !== "new" && !post) notFound();

  // Taxonomía: solo sobre un artículo ya guardado (necesita id).
  const [vocab, taxonomy] = post
    ? await Promise.all([listActiveVocab(), getPostTaxonomy(post.id)])
    : [null, null];

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

      {post ? (
        <>
          <section id="serie-articulo" className="mt-8 rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">Orden de lectura por series</h2>
              <p className="mt-1 text-sm text-slate-600">
                Seleccioná la serie y escribí el número de parte de este artículo. No hace falta ingresar ningún ID técnico.
                El administrador deberá aprobarlo antes de mostrarlo públicamente.
              </p>
            </div>
            <CrmMetaPanel
              postId={post.id}
              mode="suggest"
              includeSeo
              vocab={vocab}
              initial={taxonomy || undefined}
            />
          </section>
          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <TaxonomyPicker
              postId={post.id}
              mode="suggest"
              vocab={vocab}
              initial={taxonomy || undefined}
              specialtyHint={profile.specialty || ""}
            />
          </section>
        </>
      ) : (
        <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50/50 p-5 text-sm text-slate-700">
          <h2 className="font-bold text-slate-900">¿Dónde se asigna la serie?</h2>
          <p className="mt-1">
            Guardá este artículo primero. Después de guardarlo aparecerá aquí el bloque <strong>Orden de lectura por series</strong>,
            con los campos Serie y Número de parte.
          </p>
        </section>
      )}
    </main>
  );
}
