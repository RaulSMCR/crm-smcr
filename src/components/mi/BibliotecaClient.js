"use client";

// Biblioteca de la PWA: historial de lectura + artículos recomendados.
// Los artículos abren el blog público (/blog/[slug]), fuera del shell de /mi.
import Link from "next/link";
import { useMiResource } from "@/components/mi/useMiResource";
import {
  SectionHeader,
  SkeletonCards,
  ErrorState,
  EmptyState,
  Card,
  Pill,
} from "@/components/mi/ui";

function PostRow({ post, leido }) {
  return (
    <Link href={`/blog/${post.slug}`} className="block">
      <Card>
        <div className="flex items-start gap-3">
          {post.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImage}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-xl bg-brand-100" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 font-semibold text-neutral-900">{post.title}</p>
              {leido ? <Pill tone="teal">Leído</Pill> : null}
            </div>
            {post.autor ? <p className="mt-0.5 text-xs text-neutral-500">{post.autor}</p> : null}
            {post.excerpt ? (
              <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{post.excerpt}</p>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function BibliotecaClient() {
  const { data, error, loading, reload } = useMiResource("/api/mi/biblioteca");

  return (
    <section>
      <SectionHeader
        title="Biblioteca"
        subtitle="Tu historial de lectura y artículos recomendados."
      />

      {loading ? (
        <SkeletonCards count={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="space-y-6">
          {data.historial.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Tu historial
              </h2>
              <div className="space-y-3">
                {data.historial.map((item) => (
                  <PostRow key={item.eventId} post={item.post} leido={item.isRead} />
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Recomendados
            </h2>
            {data.recomendados.length > 0 ? (
              <div className="space-y-3">
                {data.recomendados.map((post) => (
                  <PostRow key={post.slug} post={post} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin recomendaciones por ahora"
                message="Pronto vas a ver artículos sugeridos acá."
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
