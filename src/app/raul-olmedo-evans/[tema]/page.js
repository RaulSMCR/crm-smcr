import Link from "next/link";
import { notFound } from "next/navigation";
import HubTracker from "@/components/hub/HubTracker";
import HubTrackedLink from "@/components/hub/HubTrackedLink";
import JsonLd from "@/components/JsonLd";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { buildMetadata } from "@/lib/seo";
import { grafo, nodoMigas, ref } from "@/lib/jsonld";
import { RAUL_PERSON_ID, getHubData, getPublishedHubTopics, getRaulAgendaUrl, readHubTheme } from "@/lib/hub-raul";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export function generateStaticParams() {
  return getPublishedHubTopics().map((topic) => ({ tema: topic.slug }));
}

export async function generateMetadata({ params }) {
  const { tema } = await params;
  const doc = readHubTheme(String(tema || ""));
  if (!doc) return { title: "Tema no encontrado", robots: { index: false, follow: false } };
  return buildMetadata({
    title: doc.titulo_seo || doc.titulo,
    description: doc.meta || doc.resumen,
    path: `raul-olmedo-evans/${tema}`,
    subtitle: "Raúl Olmedo Evans",
    type: "article",
  });
}

export default async function RaulThemePage({ params }) {
  const { tema } = await params;
  const slug = String(tema || "");
  const doc = readHubTheme(slug);
  if (!doc) notFound();
  const hub = getHubData();
  const agendaUrl = await getRaulAgendaUrl();
  const url = siteUrl(`raul-olmedo-evans/${slug}`);
  const schema = grafo(
    {
      "@type": "Article",
      "@id": `${url}#article`,
      headline: doc.titulo,
      description: doc.meta || doc.resumen,
      url,
      inLanguage: "es-CR",
      datePublished: new Date(doc.fecha).toISOString(),
      dateModified: new Date(doc.actualizado || doc.fecha).toISOString(),
      author: ref(RAUL_PERSON_ID),
      reviewedBy: ref(RAUL_PERSON_ID),
      isPartOf: ref(siteUrl("raul-olmedo-evans")),
    },
    { "@type": "Person", "@id": RAUL_PERSON_ID, name: hub.nombre, url: siteUrl(hub.url_perfil) },
    nodoMigas([
      { nombre: hub.nombre, url: siteUrl("raul-olmedo-evans") },
      { nombre: doc.titulo, url },
    ]),
  );

  return (
    <main className="bg-surface pb-20">
      <JsonLd data={schema} />
      <HubTracker />
      <div className="container max-w-6xl py-12 md:py-20">
        <HubTrackedLink href="/raul-olmedo-evans" eventName="click_theme_hub" destination="hub" className="text-sm font-bold text-nv-teal-deep underline underline-offset-4">← Volver al hub de Raúl Olmedo Evans</HubTrackedLink>
        <div className="mt-8 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)_260px]">
          <nav aria-label="Índice de la página" className="hidden h-fit lg:sticky lg:top-28 lg:block">
            <p className="hub-kicker">En esta página</p>
            <ul className="mt-4 space-y-3 text-sm text-neutral-700">
              <li><a href="#cuando-consultar" className="hover:text-nv-teal-deep">Cuándo consultar</a></li>
              <li><a href="#agendar" className="hover:text-nv-teal-deep">Agendar</a></li>
            </ul>
          </nav>
          <article>
            <p className="hub-kicker">Tema de consulta</p>
            <h1 className="mt-2 font-display text-5xl font-light leading-tight text-nv-teal-deep">{doc.titulo}</h1>
            <p className="mt-5 text-lg leading-8 text-neutral-700">{doc.resumen}</p>
            {doc.body ? (
              <div className="prose prose-lg mt-10 max-w-none text-neutral-800">
                <MarkdownRenderer content={doc.body} />
              </div>
            ) : (
              <div className="mt-10 rounded-nv border border-nv-teal-deep/20 bg-nv-cream-hi p-6">
                <p className="hub-kicker">Tema en preparaci\u00f3n</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-nv-teal-deep">Estamos preparando esta p\u00e1gina</h2>
                <p className="mt-3 leading-7 text-neutral-700">El contenido de este tema se incorporar\u00e1 pr\u00f3ximamente. Si quer\u00e9s conversar sobre tu situaci\u00f3n, pod\u00e9s solicitar una cita.</p>
              </div>
            )}
            {doc.body ? (
            <section id="cuando-consultar" className="mt-10 rounded-nv border-l-4 border-nv-teal-mid bg-nv-cream-hi p-6">
              <h2 className="font-display text-3xl font-semibold text-nv-teal-deep">Cuándo consultar</h2>
              <p className="mt-3 leading-7 text-neutral-700">Podés consultar cuando el malestar se repite, limita tu vida cotidiana o querés comprenderlo con acompañamiento clínico. Si hay peligro inmediato, dirigite a <Link href="/ayuda-inmediata" className="font-bold underline">ayuda inmediata</Link>.</p>
            </section>
            ) : null}
          </article>
          <aside id="agendar" className="h-fit rounded-nv border border-nv-teal-deep/20 bg-nv-cream-hi p-6 lg:sticky lg:top-28">
            <p className="hub-kicker">Un siguiente paso</p>
            <h2 className="mt-2 font-display text-3xl text-nv-teal-deep">Hablarlo en consulta</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-700">La primera conversación permite ubicar qué está ocurriendo y qué tipo de trabajo puede tener sentido.</p>
            <HubTrackedLink href={agendaUrl} eventName="click_theme_agendar" destination={slug} className="btn btn-accent mt-6 w-full">Agendar sesión</HubTrackedLink>
            <HubTrackedLink href="/raul-olmedo-evans/tratamiento-breve-15-sesiones" eventName="click_theme_15_sesiones" destination="tratamiento-breve-15-sesiones" className="mt-4 block text-center text-sm font-bold text-nv-teal-deep underline underline-offset-4">Ver formato de 15 sesiones</HubTrackedLink>
          </aside>
        </div>
      </div>
    </main>
  );
}
