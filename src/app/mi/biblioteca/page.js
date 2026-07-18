// src/app/mi/biblioteca/page.js — Biblioteca del paciente (server component).
//
// Historial de lectura (PostViewEvent del userId) + recomendaciones. El userId se
// vincula en registro y ahora también en login (ver auth-actions · RIESGOS-6).
//
// "Para vos": el modelo Post NO tiene categorías ni tags, así que la afinidad se
// deriva del AUTOR de los posts ya leídos (cada autor = un profesional con su
// especialidad). Ver AUDIT-PWA · DECISIONES.
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatRelative } from "@/components/mi/ui";
import SafeImage from "@/components/SafeImage";
import { IMAGE_FALLBACKS } from "@/lib/images";

export const dynamic = "force-dynamic";
export const metadata = { title: "Biblioteca" };

const SECTION_LIMIT = 5;

const postSelect = {
  id: true,
  slug: true,
  title: true,
  coverImage: true,
  author: { select: { user: { select: { name: true } } } },
};

function PostCard({ post, caption }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-colors hover:bg-neutral-50"
    >
      {post.coverImage ? (
        <SafeImage src={post.coverImage} alt="" fallbackSrc={IMAGE_FALLBACKS.article} className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 w-full bg-brand-100" />
      )}
      <div className="p-4">
        <p className="line-clamp-2 font-semibold text-neutral-900">{post.title}</p>
        <p className="mt-1 text-xs text-neutral-500">
          {post.author?.user?.name || "Equipo SMCR"}
          {caption ? ` · ${caption}` : ""}
        </p>
      </div>
    </Link>
  );
}

export default async function MiBibliotecaPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/mi/biblioteca");

  const patientId = String(session.userId || session.sub);

  // Historial del paciente (aislado por userId) + señal de afinidad por autor.
  const [seguiLeyendo, leidos, vistos] = await Promise.all([
    prisma.postViewEvent.findMany({
      where: { userId: patientId, isRead: false, post: { status: "PUBLISHED" } },
      orderBy: { updatedAt: "desc" },
      take: SECTION_LIMIT,
      select: { id: true, updatedAt: true, post: { select: postSelect } },
    }),
    prisma.postViewEvent.findMany({
      where: { userId: patientId, isRead: true, post: { status: "PUBLISHED" } },
      orderBy: { readAt: "desc" },
      take: SECTION_LIMIT,
      select: { id: true, readAt: true, post: { select: postSelect } },
    }),
    prisma.postViewEvent.findMany({
      where: { userId: patientId },
      select: { postId: true, post: { select: { authorId: true } } },
    }),
  ]);

  const viewedPostIds = [...new Set(vistos.map((v) => v.postId))];
  const authorIds = [...new Set(vistos.map((v) => v.post?.authorId).filter(Boolean))];
  const excludeIds = viewedPostIds.length ? viewedPostIds : ["__none__"];

  // "Para vos": posts de los autores ya leídos que el paciente todavía no vio.
  let recomendados = [];
  if (authorIds.length > 0) {
    recomendados = await prisma.post.findMany({
      where: { status: "PUBLISHED", authorId: { in: authorIds }, id: { notIn: excludeIds } },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
      select: postSelect,
    });
  }

  // Fallback (sin historial o afinidad agotada): últimas publicaciones.
  let recomendadosTitle = "Para vos";
  if (recomendados.length === 0) {
    recomendadosTitle = "Últimas publicaciones";
    recomendados = await prisma.post.findMany({
      where: { status: "PUBLISHED", id: { notIn: excludeIds } },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
      select: postSelect,
    });
  }

  const vacio =
    seguiLeyendo.length === 0 && leidos.length === 0 && recomendados.length === 0;

  return (
    <section>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-brand-800">Biblioteca</h1>
        <p className="mt-1 text-sm text-neutral-600">Tu historial de lectura y artículos para vos.</p>
      </header>

      {vacio ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
          <p className="font-semibold text-neutral-800">Todavía no hay artículos</p>
          <p className="mt-1 text-sm text-neutral-500">
            Cuando leas notas del blog, aparecerán acá.
          </p>
          <Link
            href="/blog"
            className="mt-4 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
          >
            Explorar el blog
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {seguiLeyendo.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Seguí leyendo
              </h2>
              <div className="space-y-3">
                {seguiLeyendo.map((ev) => (
                  <PostCard key={ev.id} post={ev.post} caption={formatRelative(ev.updatedAt)} />
                ))}
              </div>
            </div>
          ) : null}

          {leidos.length > 0 ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold uppercase tracking-wide text-neutral-500 [&::-webkit-details-marker]:hidden">
                <span>Leídos ({leidos.length})</span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <div className="mt-2 space-y-3">
                {leidos.map((ev) => (
                  <PostCard key={ev.id} post={ev.post} caption={`leído ${formatRelative(ev.readAt)}`} />
                ))}
              </div>
            </details>
          ) : null}

          {recomendados.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {recomendadosTitle}
              </h2>
              <div className="space-y-3">
                {recomendados.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
