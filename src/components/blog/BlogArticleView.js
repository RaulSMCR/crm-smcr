import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import PostMarketingTracker from "@/components/blog/PostMarketingTracker";
import SafeImage, { SafeAvatar } from "@/components/SafeImage";
import SafeCover from "@/components/SafeCover";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { siteUrl } from "@/lib/site-url";
import { defaultOgImage } from "@/lib/seo";
import { grafo, ref, nodoMigas, idArticulo, idPersona, ID_SITIO, ID_ORGANIZACION } from "@/lib/jsonld";

const formatDate = (date) =>
  new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(date));

/**
 * Render del artículo tal como se ve en la página pública. Reutilizado por la ruta
 * pública (/blog/[slug], PUBLISHED, con tracking/JSON-LD) y por el preview de
 * borrador del panel (/blog/preview/[id], sin tracking).
 */
export default function BlogArticleView({ post, slug, preview = false }) {
  const authorUser = post.author.user;
  const coverCreditParts = [post.coverImageTitle, post.coverImageAuthor].filter(Boolean);

  // "Actualizado el …" solo aparece si hubo una edición real y posterior a la
  // publicación. Mostrar una fecha de actualización igual a la de publicación es
  // ruido, y mostrar una anterior sería un error visible.
  const mostrarActualizado =
    post.contentUpdatedAt &&
    new Date(post.contentUpdatedAt).getTime() - new Date(post.createdAt).getTime() > 60 * 1000;

  // El autor deja de venir embebido y pasa a ser una referencia al `@id` del
  // perfil, que es donde la persona está descrita una sola vez y con sus
  // credenciales. Antes, cada artículo declaraba un `Person` con nombre y foto:
  // quince artículos del mismo autor eran quince personas distintas que se
  // llamaban igual, y ninguna tenía colegiatura.
  //
  // Si el autor no tiene slug —no debería pasar— se cae al objeto embebido, que
  // es peor pero no deja el artículo sin autor.
  const autorSlug = post.author?.slug;

  // El botón de agendar solo aparece si el autor realmente acepta citas: perfil
  // aprobado, cuenta activa y al menos un servicio con tarifa vigente. Es el
  // mismo criterio de su ficha pública. Ofrecer el botón sin comprobarlo manda
  // al lector a una pantalla que le dice que no se puede, que es peor que no
  // ofrecerlo. `?? false` cubre a quien llame al componente sin estos campos.
  const puedeAgendar = Boolean(
    post.author?.isApproved &&
      post.author?.user?.isActive &&
      post.author?.serviceAssignments?.length,
  );
  const articleSchema = grafo(
    {
      "@type": "Article",
      "@id": idArticulo(slug),
      headline: post.title,
      description: post.excerpt || undefined,
      image: post.coverImage || defaultOgImage(post.title),
      datePublished: new Date(post.createdAt).toISOString(),
      // `contentUpdatedAt` y no `updatedAt`: aquel se mueve con cada visita por
      // el contador de vistas. Si está nulo —los artículos anteriores a este
      // cambio— se cae a la fecha de publicación, que es no afirmar nada, en vez
      // de inventar una edición que no sabemos si ocurrió.
      dateModified: new Date(post.contentUpdatedAt || post.createdAt).toISOString(),
      url: siteUrl(`blog/${slug}`),
      inLanguage: "es-CR",
      isPartOf: ref(ID_SITIO),
      author: autorSlug
        ? ref(idPersona(autorSlug))
        : { "@type": "Person", name: authorUser.name, image: authorUser.image || undefined },
      publisher: ref(ID_ORGANIZACION),
    },
    nodoMigas([
      { nombre: "Blog", url: siteUrl("blog") },
      { nombre: post.title, url: siteUrl(`blog/${slug}`) },
    ]),
  );

  return (
    <article className="min-h-screen bg-surface">
      {!preview ? <JsonLd data={articleSchema} /> : null}
      {!preview ? <PostMarketingTracker slug={slug} title={post.title} /> : null}

      {/* Hero / Cabecera */}
      <header className="relative flex h-[400px] w-full items-center justify-center overflow-hidden bg-gray-900">
        {post.coverImage ? (
          <SafeCover
            src={post.coverImage}
            // Antes acá iba `coverImageTitle`, que es el nombre de la obra para
            // el crédito —y ya se muestra abajo como tal—, no una descripción de
            // lo que se ve. Para un lector de pantalla eso no describía nada.
            alt={post.coverImageAlt || post.title}
            fallbackSrc=""
            priority
            sizes="100vw"
            focusX={post.coverImageFocusX}
            focusY={post.coverImageFocusY}
            scale={post.coverImageScale}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-gray-900 opacity-90" />
        )}
        <div className="image-overlay-strong absolute inset-0" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="mb-4">
            <span className="contrast-on-image rounded-full bg-blue-600 px-3 py-1 text-sm font-bold uppercase tracking-wider">
              Blog
            </span>
          </div>
          <h1 className="contrast-on-image mb-4 text-4xl font-light leading-tight md:text-6xl">{post.title}</h1>
          <p className="contrast-on-image-muted text-lg">
            {/* `<time dateTime>` da la fecha en formato legible por máquina. El
                listado ya lo hacía; el detalle mostraba solo el texto. */}
            <time dateTime={new Date(post.createdAt).toISOString()}>{formatDate(post.createdAt)}</time>
            {mostrarActualizado ? (
              <>
                {" · "}
                <span className="text-base">
                  Actualizado el{" "}
                  <time dateTime={new Date(post.contentUpdatedAt).toISOString()}>
                    {formatDate(post.contentUpdatedAt)}
                  </time>
                </span>
              </>
            ) : null}
          </p>
        </div>
      </header>

      {/* Contenido Principal */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        {(coverCreditParts.length > 0 || post.coverImageNote) && (
          <div className="-mt-6 mb-8 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            {coverCreditParts.length > 0 ? (
              <p>
                <span className="font-semibold text-slate-800">{coverCreditParts.join(" - ")}</span>
              </p>
            ) : null}
            {post.coverImageNote ? <p className="mt-1">{post.coverImageNote}</p> : null}
          </div>
        )}

        {/* Tarjeta del Autor */}
        <div className="flex items-center gap-4 p-6 bg-gray-50 rounded-xl border border-gray-100 mb-10">
          <div className="w-16 h-16 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
            {authorUser.image ? (
              <SafeAvatar src={authorUser.image} name={authorUser.name} className="h-full w-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 font-bold text-xl">
                {authorUser.name?.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase font-bold tracking-wide">Escrito por</p>
            <p className="text-xl font-bold text-gray-900">{authorUser.name}</p>
            <p className="text-blue-600 font-medium">{post.author.specialty || "Profesional de Salud"}</p>
          </div>
          {/* Las dos salidas, en orden de compromiso: primero conocer a quien
              escribe —donde está la credencial verificada, y el nodo al que el
              JSON-LD ya apunta como autor—, después reservar. Antes esto era un
              único botón que llevaba directo a la reserva, y quien solo quería
              saber quién escribía caía en un formulario.

              Deja de esconderse en móvil: era `hidden sm:block`, de modo que en
              teléfono la tarjeta del autor no ofrecía ninguna acción. */}
          <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
            {autorSlug ? (
              <Link href={`/profesionales/${autorSlug}`} className="btn btn-outline">
                Ver perfil
              </Link>
            ) : null}
            {puedeAgendar ? (
              <Link href={`/agendar/${post.author.id}`} className="btn btn-accent">
                Agendar cita
              </Link>
            ) : null}
          </div>
        </div>

        {/* Cuerpo del Artículo (markdown → formato) */}
        <div className="prose prose-lg prose-blue max-w-none text-gray-700 leading-relaxed">
          <MarkdownRenderer content={post.content || ""} />
        </div>

        {/* Bloque de autor al pie.
            El grafo JSON-LD ya dice que este artículo lo escribió esa persona y
            que esa persona tiene una colegiatura verificada. Esto es lo mismo
            dicho en HTML, para el lector: quién escribe, con qué respaldo, y por
            dónde seguir leyéndolo. Un grafo que el HTML no refleja es una
            afirmación que el lector no puede comprobar. */}
        {autorSlug ? (
          <aside className="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Sobre quien escribe</p>
            <div className="mt-3 flex items-start gap-4">
              <SafeAvatar src={authorUser.image} alt={authorUser.name} size={56} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900">{authorUser.name}</p>
                {post.author.specialty ? (
                  <p className="text-sm font-medium text-blue-700">{post.author.specialty}</p>
                ) : null}
                {post.author.licensingBody && post.author.licenseNumber ? (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {post.author.licensingBody} · Mat. {post.author.licenseNumber}
                  </p>
                ) : null}
                {post.author.bio ? (
                  <p className="mt-2 text-sm leading-relaxed text-gray-700">{post.author.bio}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                  <Link href={`/profesionales/${autorSlug}`} className="text-blue-600 hover:underline">
                    Ver su perfil
                  </Link>
                  {puedeAgendar ? (
                    <Link href={`/agendar/${post.author.id}`} className="text-blue-600 hover:underline">
                      Agendar una cita
                    </Link>
                  ) : null}
                  <Link href={`/blog?autor=${autorSlug}`} className="text-blue-600 hover:underline">
                    Sus otros artículos
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        ) : null}

        {/* Footer del Artículo */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link href="/blog" className="text-blue-600 font-bold hover:underline">
            ← Volver a todos los artículos
          </Link>
        </div>
      </div>
    </article>
  );
}
