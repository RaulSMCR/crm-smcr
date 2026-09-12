import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import HubTracker from "@/components/hub/HubTracker";
import HubTrackedLink from "@/components/hub/HubTrackedLink";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { buildMetadata, resolveSeo } from "@/lib/seo";
import { grafo, nodoMigas, ref } from "@/lib/jsonld";
import { siteUrl } from "@/lib/site-url";
import { RAUL_PERSON_ID, formatHubPrice, getManagedHubData, getRaulAgenda, readManagedHubDocument } from "@/lib/hub-raul";

export const revalidate = 3600;

export async function generateMetadata() {
  const doc = await readManagedHubDocument("raul-olmedo-evans", "tratamiento-breve-15-sesiones");
  if (!doc) return { title: "Tratamiento no disponible", robots: { index: false, follow: false } };
  const seo = resolveSeo(
    { metaTitle: doc.titulo_seo, metaDescription: doc.meta, ogImage: doc.ogImage, noindex: doc.noindex },
    {
      title: doc.titulo || "Tratamiento breve de 15 sesiones",
      description: doc.resumen || "Un formato de trabajo acotado para explorar angustia y duelo.",
      subtitle: "Raúl Olmedo Evans",
    },
  );
  return buildMetadata({
    title: seo.title,
    description: seo.description,
    image: seo.image,
    imageAlt: seo.imageAlt,
    path: "raul-olmedo-evans/tratamiento-breve-15-sesiones",
    subtitle: "Raúl Olmedo Evans",
    noindex: seo.noindex,
  });
}

export default async function TratamientoBrevePage() {
  const [doc, hub] = await Promise.all([
    readManagedHubDocument("raul-olmedo-evans", "tratamiento-breve-15-sesiones"),
    getManagedHubData(),
  ]);
  if (!doc || !hub) notFound();
  const agenda = await getRaulAgenda();
  const agendaUrl = agenda.url;
  const precio = formatHubPrice(agenda.rango);
  const agendaEnabled = !hub.herramientas_habilitadas.length || hub.herramientas_habilitadas.includes("agenda");
  const url = siteUrl("raul-olmedo-evans/tratamiento-breve-15-sesiones");
  const schema = grafo(
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name: doc.titulo,
      description: doc.meta,
      url,
      provider: ref(RAUL_PERSON_ID),
      serviceType: "Psicoterapia psicodinámica breve",
      areaServed: { "@type": "Country", name: "Costa Rica" },
      // El mismo precio que ve el visitante. Sin tarifa vigente no se declara
      // oferta: un precio en el marcado que no coincide con la página es peor
      // que ninguno.
      offers: agenda.rango
        ? agenda.rango.min === agenda.rango.max
          ? { "@type": "Offer", price: agenda.rango.min, priceCurrency: "CRC", url: siteUrl(agendaUrl) }
          : {
              "@type": "AggregateOffer",
              lowPrice: agenda.rango.min,
              highPrice: agenda.rango.max,
              priceCurrency: "CRC",
              url: siteUrl(agendaUrl),
            }
        : undefined,
    },
    {
      "@type": "Person",
      "@id": RAUL_PERSON_ID,
      name: hub.nombre,
      url: siteUrl(hub.url_perfil),
    },
    nodoMigas([
      { nombre: hub.nombre, url: siteUrl("raul-olmedo-evans") },
      { nombre: doc.titulo, url },
    ]),
  );

  return (
    <main className="bg-surface pb-20">
      <JsonLd data={schema} />
      <HubTracker />
      <div className="container max-w-5xl py-12 md:py-20">
        <HubTrackedLink href="/raul-olmedo-evans" eventName="click_15_sesiones_hub" destination="hub" className="text-sm font-bold text-nv-teal-deep underline underline-offset-4">← Volver al hub de Raúl Olmedo Evans</HubTrackedLink>
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <article>
            <p className="hub-kicker">Formato clínico</p>
            <h1 className="mt-2 font-display text-5xl font-light leading-tight text-nv-teal-deep">{doc.titulo}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-700">{doc.meta}</p>
            <div className="prose prose-lg mt-10 max-w-none text-neutral-800">
              <MarkdownRenderer content={doc.body} />
            </div>
          </article>
          {agendaEnabled ? <aside className="h-fit rounded-nv border border-nv-teal-deep/20 bg-nv-cream-hi p-6 lg:sticky lg:top-28">
            <p className="hub-kicker">Consulta en línea</p>
            <p className="mt-3 font-display text-3xl text-nv-teal-deep">{precio || "Valor al agendar"}</p>
            <p className="mt-1 text-sm text-neutral-700">{hub.duracion_min} minutos · {hub.modalidad}</p>
            <HubTrackedLink href={agendaUrl} eventName="click_15_sesiones_agendar" destination="agenda" className="btn btn-accent mt-6 w-full">Agendar sesión</HubTrackedLink>
            <p className="mt-4 text-xs leading-5 text-neutral-600">La indicación y la continuidad se conversan según tu situación clínica.</p>
          </aside> : null}
        </div>
      </div>
    </main>
  );
}
