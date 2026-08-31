import Link from "next/link";
import ServiceCategoryCard from "@/components/ServiceCategoryCard";

/**
 * La capa que divide la home en dos a la altura de los servicios.
 *
 * El reparto es 2/3 + 1/3 y no mitad y mitad a propósito. Un split simétrico
 * pone dos títulos del mismo peso a la misma altura, y ahí el ojo no tiene por
 * dónde entrar: se lee como dos páginas pegadas. Con dos tercios los servicios
 * mandan —son la columna comercial— y el blog acompaña sin competir.
 *
 * Y el blog no repite el formato de tarjeta. Ocho tarjetas idénticas una al
 * lado de la otra son un muro, y en móvil, donde las columnas colapsan, serían
 * ocho en fila vertical. El índice numerado además es más fiel a lo que el
 * blog dice de sí mismo en su propio metadata: ensayos largos, no consejos
 * rápidos. Un título y una firma piden entrar a leer; una miniatura no.
 */

const formatoFecha = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function BlogIndex({ posts }) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-brand-900">Del blog</h2>
      <p className="mt-2 text-sm text-neutral-700">
        Historia, escuelas y discusiones sobre la salud mental, escritas por el equipo.
      </p>

      <ol className="mt-6 border-t border-neutral-300">
        {posts.map((post, indice) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="group flex gap-4 border-b border-neutral-300 py-4 no-underline hover:no-underline"
            >
              <span
                aria-hidden="true"
                className="pt-0.5 text-xs font-bold tracking-[0.18em] text-accent-800"
              >
                {String(indice + 1).padStart(2, "0")}
              </span>

              <span className="min-w-0">
                <span className="block text-base font-semibold leading-snug text-neutral-950 group-hover:underline">
                  {post.title}
                </span>
                <span className="mt-1 block text-xs text-neutral-600">
                  {post.authorName}
                  {post.createdAt ? (
                    <>
                      {" · "}
                      <time dateTime={post.createdAt}>
                        {formatoFecha.format(new Date(post.createdAt))}
                      </time>
                    </>
                  ) : null}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <Link
        href="/blog"
        className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-800 no-underline hover:underline"
      >
        Ir a la biblioteca
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export default function HomeServicesAndBlog({ categories = [], posts = [] }) {
  if (!categories.length) {
    return (
      <section className="bg-neutral-50 py-12 text-center">
        <p className="text-neutral-700">Cargando servicios...</p>
      </section>
    );
  }

  // Sin artículos la columna angosta no se dibuja vacía: los servicios se
  // quedan con todo el ancho, que es la home de siempre.
  const hayBlog = posts.length > 0;

  return (
    <section className="bg-surface py-16">
      <div className="container mx-auto px-4">
        <div
          className={
            hayBlog
              ? "grid gap-12 lg:grid-cols-[2fr_1fr] lg:gap-14"
              : "grid gap-12"
          }
        >
          <div>
            <h2 className="text-3xl font-bold text-brand-900">Nuestros servicios</h2>
            <p className="mt-2 text-sm text-neutral-700">
              Atención con especialistas colegiados, en línea o presencial.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
              {categories.map((category) => (
                <ServiceCategoryCard key={category.slug} category={category} />
              ))}
            </div>

            <Link
              href="/servicios"
              className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-brand-800 no-underline hover:underline"
            >
              Otros servicios
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {hayBlog ? (
            <div className="lg:border-l lg:border-neutral-300 lg:pl-14">
              <BlogIndex posts={posts} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
