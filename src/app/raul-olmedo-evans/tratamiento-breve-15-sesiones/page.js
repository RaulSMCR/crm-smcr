import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import HubTracker from "@/components/hub/HubTracker";
import HubTrackedLink from "@/components/hub/HubTrackedLink";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { buildMetadata } from "@/lib/seo";
import { grafo, nodoMigas, ref } from "@/lib/jsonld";
import { siteUrl } from "@/lib/site-url";
import { RAUL_PERSON_ID, formatHubPrice, getHubData, getRaulAgendaUrl, readHubDocument } from "@/lib/hub-raul";

export const revalidate = 3600;

export function generateMetadata() {
  const doc = readHubDocument("tratamiento-breve-15-sesiones");
  return buildMetadata({
    title: doc?.titulo_seo || doc?.titulo || "Tratamiento breve de 15 sesiones",
    description: doc?.meta || "Un formato de trabajo acotado para explorar angustia y duelo.",
    path: "raul-olmedo-evans/tratamiento-breve-15-sesiones",
    subtitle: "Raúl Olmedo Evans",
  });
}

export default async function TratamientoBrevePage() {
  const doc = readHubDocument("tratamiento-breve-15-sesiones");
  if (!doc) notFound();
  const hub = getHubData();
  const agendaUrl = await getRaulAgendaUrl();
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
      offers: { "@type": "Offer", price: hub.precio_crc, priceCurrency: "CRC", url: siteUrl(agendaUrl) },
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
          <aside className="h-fit rounded-nv border border-nv-teal-deep/20 bg-nv-cream-hi p-6 lg:sticky lg:top-28">
            <p className="hub-kicker">Consulta en línea</p>
            <p className="mt-3 font-display text-3xl text-nv-teal-deep">{formatHubPrice()}</p>
            <p className="mt-1 text-sm text-neutral-700">{hub.duracion_min} minutos · {hub.modalidad}</p>
            <HubTrackedLink href={agendaUrl} eventName="click_15_sesiones_agendar" destination="agenda" className="btn btn-accent mt-6 w-full">Agendar sesión</HubTrackedLink>
            <p className="mt-4 text-xs leading-5 text-neutral-600">La indicación y la continuidad se conversan según tu situación clínica.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
