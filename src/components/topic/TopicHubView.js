import JsonLd from "@/components/JsonLd";
import SafeImage from "@/components/SafeImage";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import TopicHubTracker from "@/components/topic/TopicHubTracker";
import TopicMedia from "@/components/topic/TopicMedia";
import TopicTrackedLink from "@/components/topic/TopicTrackedLink";
import { defaultOgImage } from "@/lib/seo";
import { safeTopicMediaUrl, topicSectionLabel } from "@/lib/topic";
import { grafo, nodoMigas, ref, ID_ORGANIZACION, ID_SITIO } from "@/lib/jsonld";
import { siteUrl } from "@/lib/site-url";
import { etiquetaDeRango } from "@/lib/service-pricing";

function section(topic, type) {
  return (topic.sections || []).find((item) => item.type === type) || null;
}

function shouldRender(topic, type, hasContent) {
  const configured = section(topic, type);
  if (!hasContent) return false;
  return configured ? configured.isVisible : true;
}

function sectionHeading(topic, type, fallback) {
  return section(topic, type)?.title || fallback || topicSectionLabel(type);
}

function MarkdownBlock({ body }) {
  return body ? <div className="prose prose-lg max-w-none text-slate-700"><MarkdownRenderer content={body} /></div> : null;
}

function ArticleCard({ article, topic }) {
  return (
    <TopicTrackedLink
      href={`/blog/${article.slug}`}
      eventName="click_topic_article"
      eventParams={{ topic_slug: topic.slug, content_type: "article", source_page: `/${topic.slug}` }}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-400 hover:shadow-md"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
        {article.role === "PRIMARY" ? "Artículo principal" : "Lectura"}
      </p>
      <h3 className="mt-2 text-xl font-semibold text-slate-950 group-hover:text-brand-800">{article.title}</h3>
      {article.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{article.excerpt}</p> : null}
      <span className="mt-4 inline-block text-sm font-semibold text-brand-700">Leer sobre {topic.name.toLowerCase()} →</span>
    </TopicTrackedLink>
  );
}

export default function TopicHubView({ topic, preview = false }) {
  const validVideo = safeTopicMediaUrl(topic.introVideoUrl);
  const validPodcast = safeTopicMediaUrl(topic.podcastUrl);
  const hasFeatured = topic.featuredArticles.length > 0;
  const hasExplore = topic.exploreArticles.length > 0;
  const hasPerspectives = topic.perspectives.length > 0;
  const hasServices = topic.services.length > 0;
  const hasProfessionals = topic.professionals.length > 0;
  const hasRelated = topic.relatedTopics.length > 0;
  const hasFaqs = topic.faqs.length > 0;
  const ctaHref = hasProfessionals ? "#profesionales" : hasServices ? "#servicios" : hasFeatured ? "#destacados" : section(topic, "EDITORIAL_INTRO")?.body ? "#introduccion" : "#";

  const faqSchema = hasFaqs
    ? {
        "@type": "FAQPage",
        "@id": `${siteUrl(topic.slug)}#faq`,
        mainEntity: topic.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null;

  const pageSchema = grafo(
    {
      "@type": "CollectionPage",
      "@id": `${siteUrl(topic.slug)}#topic`,
      name: topic.title || topic.name,
      description: topic.excerpt || undefined,
      url: siteUrl(topic.slug),
      image: topic.heroImage || defaultOgImage(topic.title || topic.name),
      inLanguage: "es-CR",
      isPartOf: ref(ID_SITIO),
      publisher: ref(ID_ORGANIZACION),
      about: { "@type": "Thing", name: topic.name },
    },
    nodoMigas([
      { nombre: "Inicio", url: siteUrl("") },
      { nombre: topic.title || topic.name, url: siteUrl(topic.slug) },
    ]),
    faqSchema,
  );

  return (
    <main className="min-h-screen bg-surface">
      {!preview ? <JsonLd data={pageSchema} /> : null}
      {!preview ? <TopicHubTracker topicSlug={topic.slug} /> : null}

      <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-10">
        <nav aria-label="Migas de pan" className="mb-6 text-sm text-slate-600">
          <TopicTrackedLink href="/" className="hover:text-brand-800 hover:underline">Inicio</TopicTrackedLink>
          <span aria-hidden="true" className="px-2">/</span>
          <span aria-current="page" className="font-medium text-slate-900">{topic.title || topic.name}</span>
        </nav>

        <header className="relative overflow-hidden rounded-[2rem] bg-brand-950 px-6 py-12 text-white shadow-card md:px-12 md:py-20">
          {topic.heroImage ? (
            <SafeImage src={topic.heroImage} alt={topic.heroImageAlt || topic.title || topic.name} className="absolute inset-0 h-full w-full object-cover opacity-35" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/90 to-brand-900/45" />
          <div className="relative max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-nv-teal-pale">Salud Mental Costa Rica</p>
            <h1 className="mt-4 text-4xl font-light leading-tight text-white md:text-6xl">{topic.title || topic.name}</h1>
            {topic.subtitle ? <p className="mt-4 text-xl leading-8 text-white/85">{topic.subtitle}</p> : null}
            {topic.excerpt ? <p className="mt-5 max-w-2xl text-base leading-7 text-white/80">{topic.excerpt}</p> : null}
            <TopicTrackedLink
              href={ctaHref}
              eventName="start_booking_from_topic"
              eventParams={{ topic_slug: topic.slug, content_type: "topic_hub", source_page: `/${topic.slug}` }}
              className="mt-7 inline-flex rounded-xl bg-accent-500 px-5 py-3 font-bold text-accent-950 transition hover:bg-accent-400"
            >
              Encontrar apoyo
            </TopicTrackedLink>
          </div>
        </header>

        <div className="mx-auto mt-10 max-w-5xl space-y-10">
          {shouldRender(topic, "USER_SITUATIONS", Boolean(section(topic, "USER_SITUATIONS")?.body)) ? (
            <section aria-labelledby="situaciones" className="rounded-2xl border border-accent-200 bg-accent-50 p-6 md:p-8">
              <h2 id="situaciones" className="text-2xl font-semibold text-accent-950">{sectionHeading(topic, "USER_SITUATIONS", "Qué te puede estar pasando")}</h2>
              <div className="mt-4"><MarkdownBlock body={section(topic, "USER_SITUATIONS")?.body} /></div>
            </section>
          ) : null}

          {shouldRender(topic, "EDITORIAL_INTRO", Boolean(section(topic, "EDITORIAL_INTRO")?.body)) ? (
            <section aria-labelledby="introduccion" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 id="introduccion" className="text-2xl font-semibold text-slate-950">{sectionHeading(topic, "EDITORIAL_INTRO", "Introducción editorial")}</h2>
              <div className="mt-4"><MarkdownBlock body={section(topic, "EDITORIAL_INTRO")?.body} /></div>
            </section>
          ) : null}

          {shouldRender(topic, "FEATURED_ARTICLES", hasFeatured) ? (
            <section aria-labelledby="destacados">
              <h2 id="destacados" className="text-3xl font-semibold text-slate-950">{sectionHeading(topic, "FEATURED_ARTICLES", "Artículos destacados")}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">{topic.featuredArticles.map((article) => <ArticleCard key={article.id} article={article} topic={topic} />)}</div>
            </section>
          ) : null}

          {shouldRender(topic, "EXPLORE_TOPIC", hasExplore) ? (
            <section aria-labelledby="explorar">
              <h2 id="explorar" className="text-3xl font-semibold text-slate-950">{sectionHeading(topic, "EXPLORE_TOPIC", "Explorar este tema")}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">{topic.exploreArticles.map((article) => <ArticleCard key={article.id} article={article} topic={topic} />)}</div>
            </section>
          ) : null}

          {shouldRender(topic, "PERSPECTIVES", hasPerspectives) ? (
            <section aria-labelledby="perspectivas">
              <h2 id="perspectivas" className="text-3xl font-semibold text-slate-950">{sectionHeading(topic, "PERSPECTIVES", "Perspectivas interdisciplinarias")}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {topic.perspectives.map((perspective) => (
                  <article key={perspective.id} className="rounded-2xl border border-brand-200 bg-brand-50/60 p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Desde {perspective.discipline.name}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950">{perspective.title}</h3>
                    <div className="mt-3 text-sm leading-7 text-slate-700"><MarkdownRenderer content={perspective.content} /></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {shouldRender(topic, "VIDEO", Boolean(validVideo)) ? (
            <section aria-labelledby="video" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 id="video" className="text-2xl font-semibold text-slate-950">{sectionHeading(topic, "VIDEO", "Video")}</h2>
              {section(topic, "VIDEO")?.body ? <div className="mt-3"><MarkdownBlock body={section(topic, "VIDEO").body} /></div> : null}
              <TopicMedia kind="video" url={validVideo} topicSlug={topic.slug} />
            </section>
          ) : null}

          {shouldRender(topic, "PODCAST", Boolean(validPodcast)) ? (
            <section aria-labelledby="podcast" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 id="podcast" className="text-2xl font-semibold text-slate-950">{sectionHeading(topic, "PODCAST", "Podcast / audio")}</h2>
              {section(topic, "PODCAST")?.body ? <div className="mt-3"><MarkdownBlock body={section(topic, "PODCAST").body} /></div> : null}
              <TopicMedia kind="audio" url={validPodcast} topicSlug={topic.slug} />
            </section>
          ) : null}

          {shouldRender(topic, "FAQ", hasFaqs) ? (
            <section aria-labelledby="preguntas">
              <h2 id="preguntas" className="text-3xl font-semibold text-slate-950">{sectionHeading(topic, "FAQ", "Preguntas frecuentes")}</h2>
              <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                {topic.faqs.map((faq) => <details key={faq.id} className="p-5"><summary className="cursor-pointer font-semibold text-slate-950">{faq.question}</summary><p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{faq.answer}</p></details>)}
              </div>
            </section>
          ) : null}

          {shouldRender(topic, "SERVICES", hasServices) ? (
            <section id="servicios" aria-labelledby="servicios-titulo">
              <h2 id="servicios-titulo" className="text-3xl font-semibold text-slate-950">{sectionHeading(topic, "SERVICES", "Servicios pertinentes")}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {topic.services.map((service) => (
                  <TopicTrackedLink
                    key={service.id}
                    href={`/servicios/${service.slug}`}
                    eventName="click_topic_service"
                    eventParams={{ topic_slug: topic.slug, content_type: "service", service_id: service.id, source_page: `/${topic.slug}` }}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-400"
                  >
                    <h3 className="text-xl font-semibold text-slate-950">{service.title}</h3>
                    {service.description ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{service.description}</p> : null}
                    <p className="mt-4 text-sm font-semibold text-emerald-800">{etiquetaDeRango(service.range)} · {service.durationMin} min</p>
                    <span className="mt-4 inline-block text-sm font-semibold text-brand-700">Conocer el servicio →</span>
                  </TopicTrackedLink>
                ))}
              </div>
            </section>
          ) : null}

          {shouldRender(topic, "PROFESSIONALS", hasProfessionals) ? (
            <section id="profesionales" aria-labelledby="profesionales-titulo">
              <h2 id="profesionales-titulo" className="text-3xl font-semibold text-slate-950">{sectionHeading(topic, "PROFESSIONALS", "Profesionales relacionados")}</h2>
              <p className="mt-2 text-slate-600">Estos perfiles se muestran porque ofrecen servicios vinculados con este tema y tienen agenda disponible.</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {topic.professionals.map((professional) => (
                  <TopicTrackedLink
                    key={professional.id}
                    href={`/profesionales/${professional.slug}`}
                    eventName="click_topic_professional"
                    eventParams={{ topic_slug: topic.slug, content_type: "professional", professional_id: professional.id, source_page: `/${topic.slug}` }}
                    className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-400"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-100">
                      {professional.user.image ? <SafeImage src={professional.user.image} alt={professional.user.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xl font-bold text-brand-800">{professional.user.name?.charAt(0)}</div>}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-950">{professional.user.name}</h3>
                      <p className="mt-1 text-sm text-brand-700">{professional.specialty || "Profesional de salud"}</p>
                      {professional.bio ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{professional.bio}</p> : null}
                      <span className="mt-3 inline-block text-sm font-semibold text-brand-700">Ver perfil y disponibilidad →</span>
                    </div>
                  </TopicTrackedLink>
                ))}
              </div>
            </section>
          ) : null}

          {shouldRender(topic, "RELATED_TOPICS", hasRelated) ? (
            <section aria-labelledby="relacionados" className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 id="relacionados" className="text-2xl font-semibold text-slate-950">{sectionHeading(topic, "RELATED_TOPICS", "Temas relacionados")}</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {topic.relatedTopics.map((related) => <TopicTrackedLink key={related.id} href={`/${related.slug}`} eventName="click_topic_related" eventParams={{ topic_slug: topic.slug, target_topic_slug: related.slug, content_type: "related_topic", source_page: `/${topic.slug}` }} className="rounded-full border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">{related.title || related.name}</TopicTrackedLink>)}
              </div>
            </section>
          ) : null}

          {shouldRender(topic, "CUSTOM_RICH_TEXT", Boolean(section(topic, "CUSTOM_RICH_TEXT")?.body)) ? (
            <section aria-labelledby="texto-adicional" className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 id="texto-adicional" className="text-2xl font-semibold text-slate-950">{sectionHeading(topic, "CUSTOM_RICH_TEXT", "Información adicional")}</h2>
              <div className="mt-4"><MarkdownBlock body={section(topic, "CUSTOM_RICH_TEXT")?.body} /></div>
            </section>
          ) : null}

          {shouldRender(topic, "CTA", true) ? (
            <section className="rounded-2xl bg-brand-900 p-7 text-white md:p-9">
              <h2 className="text-2xl font-semibold text-white">{sectionHeading(topic, "CTA", "Podés empezar por donde te resulte posible")}</h2>
              {section(topic, "CTA")?.body ? <div className="mt-3 text-white/85"><MarkdownBlock body={section(topic, "CTA").body} /></div> : <p className="mt-3 max-w-2xl leading-7 text-white/80">Conocé los servicios y perfiles disponibles para decidir con más información cómo continuar.</p>}
              <TopicTrackedLink href={ctaHref} eventName="start_booking_from_topic" eventParams={{ topic_slug: topic.slug, content_type: "topic_hub", source_page: `/${topic.slug}` }} className="mt-5 inline-flex rounded-xl bg-accent-500 px-5 py-3 font-bold text-accent-950 hover:bg-accent-400">Ver opciones de atención</TopicTrackedLink>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
