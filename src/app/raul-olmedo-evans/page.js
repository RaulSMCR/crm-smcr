import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import HubTracker from "@/components/hub/HubTracker";
import HubTrackedLink from "@/components/hub/HubTrackedLink";
import HubTrackedAnchor from "@/components/hub/HubTrackedAnchor";
import MonsteraArt from "@/components/hub/MonsteraArt";
import { SafeAvatar } from "@/components/SafeImage";
import {
  RAUL_PERSON_ID,
  buildWaLink,
  formatHubPrice,
  getHubData,
  getPublishedHubTopics,
  getRaulAgendaUrl,
  getRaulProfile,
  getRaulWriting,
} from "@/lib/hub-raul";
import { buildMetadata } from "@/lib/seo";
import { grafo, nodoMigas, ref } from "@/lib/jsonld";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export function generateMetadata() {
  const hub = getHubData();
  return buildMetadata({
    title: `${hub.titulo} · ${hub.nombre}`,
    description: "Ansiedad, duelo, estrés, pareja y migración: un espacio clínico para comprender lo que te pasa hoy.",
    path: "raul-olmedo-evans",
    subtitle: hub.titulo,
  });
}

function raulPerson(hub) {
  return {
    "@type": "Person",
    "@id": RAUL_PERSON_ID,
    name: hub.nombre,
    jobTitle: "Psicólogo clínico y psicoanalista",
    url: siteUrl(hub.url_perfil),
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "Colegiatura profesional",
      identifier: { "@type": "PropertyValue", propertyID: hub.credencial.colegio, value: hub.credencial.numero },
      recognizedBy: {
        "@type": "Organization",
        name: hub.credencial.colegio,
        ...(hub.credencial.url_verificacion ? { url: hub.credencial.url_verificacion } : {}),
      },
    },
  };
}

export default async function RaulHubPage() {
  const hub = getHubData();
  const topics = getPublishedHubTopics();
  const [agendaUrl, profile, writing] = await Promise.all([getRaulAgendaUrl(), getRaulProfile(), getRaulWriting()]);
  const pageUrl = siteUrl("raul-olmedo-evans");
  const waUrl = buildWaLink("raul-olmedo-evans");

  const schema = grafo(
    {
      "@type": "CollectionPage",
      "@id": `${pageUrl}#hub`,
      url: pageUrl,
      name: `${hub.titulo} · ${hub.nombre}`,
      description: "Hub temático de Raúl Olmedo Evans sobre angustia, duelo y otros motivos de consulta.",
      inLanguage: "es-CR",
      author: ref(RAUL_PERSON_ID),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: topics.map((topic, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: topic.titulo,
          url: siteUrl(`raul-olmedo-evans/${topic.slug}`),
        })),
      },
    },
    raulPerson(hub),
    nodoMigas([{ nombre: hub.nombre, url: pageUrl }]),
  );

  return (
    <main className="hub-raul-page bg-surface pb-28">
      <JsonLd data={schema} />
      <HubTracker />

      <section className="hub-raul-hero bg-nv-teal-deep text-nv-cream-hi">
        <div className="container grid items-center gap-10 py-14 md:grid-cols-[minmax(230px,0.7fr)_minmax(0,1.3fr)] md:py-20">
          <MonsteraArt />
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-nv-teal-pale">{hub.nombre}</p>
            <h1 className="mt-3 font-display text-5xl font-light leading-[0.95] text-nv-cream-hi sm:text-6xl md:text-7xl">{hub.titulo}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-nv-cream-hi/85">Ansiedad, duelo, estrés, pareja y migración: qué son, cómo se trabajan y cuándo consultar.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <HubTrackedLink href={agendaUrl} eventName="click_hub_raul_agendar" destination="agenda" className="btn btn-accent">Agendar sesión</HubTrackedLink>
              <HubTrackedAnchor href={waUrl} target="_blank" rel="noopener noreferrer" eventName="click_hub_raul_whatsapp" destination="whatsapp" className="btn border border-nv-cream-hi/60 bg-transparent text-nv-cream-hi hover:bg-nv-cream-hi hover:text-nv-teal-deep">Escribir por WhatsApp</HubTrackedAnchor>
            </div>
            <p className="mt-5 text-sm text-nv-teal-pale">Sesión en línea de {hub.duracion_min} minutos · {formatHubPrice()}</p>
          </div>
        </div>
      </section>

      <div className="container space-y-16 py-14 md:py-20">
        <section aria-labelledby="hub-temas">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="hub-kicker">Temas</p>
              <h2 id="hub-temas" className="hub-heading">Encontrá tu punto de partida</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-neutral-700">Cada página aborda una intención de consulta específica y se mantiene separada de la información general del sitio.</p>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <HubTrackedLink key={topic.slug} href={`/raul-olmedo-evans/${topic.slug}`} eventName="click_hub_raul_tema" destination={topic.slug} className="hub-raul-card group">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-nv-teal">Tema</p>
                <h3 className="mt-3 font-display text-3xl font-semibold text-nv-teal-deep group-hover:text-nv-teal">{topic.titulo}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-700">{topic.resumen}</p>
                <span className="mt-5 inline-flex text-sm font-bold text-nv-teal-deep">Leer sobre {topic.titulo.toLowerCase()} →</span>
              </HubTrackedLink>
            ))}
          </div>
        </section>

        <section className="hub-raul-feature" aria-labelledby="hub-quince">
          <div>
            <p className="hub-kicker text-nv-cream">Quince sesiones</p>
            <h2 id="hub-quince" className="mt-2 font-display text-4xl font-light text-nv-cream-hi sm:text-5xl">Un tratamiento con un marco conversado</h2>
          </div>
          <div className="max-w-xl">
            <p className="leading-7 text-nv-cream-hi/85">Una propuesta acotada para angustia y duelo: qué dice la investigación, cómo se organiza y cuándo puede no alcanzar.</p>
            <HubTrackedLink href="/raul-olmedo-evans/tratamiento-breve-15-sesiones" eventName="click_hub_raul_15_sesiones" destination="tratamiento-breve-15-sesiones" className="mt-6 inline-flex font-bold text-nv-cream-hi underline decoration-nv-coral underline-offset-4 hover:text-white">Leer el formato de 15 sesiones →</HubTrackedLink>
          </div>
        </section>

        <section aria-labelledby="hub-herramientas" className="hidden">
          <h2 id="hub-herramientas" className="hub-heading">Herramientas</h2>
        </section>

        <section aria-labelledby="hub-escritos">
          <p className="hub-kicker">Escritos</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h2 id="hub-escritos" className="hub-heading">Pensar lo que insiste</h2>
            <HubTrackedLink href={`/blog/serie/${hub.serie_destacada}`} eventName="click_hub_raul_serie" destination={hub.serie_destacada} className="font-bold text-nv-teal-deep underline underline-offset-4">La angustia y sus formas →</HubTrackedLink>
          </div>
          {writing.length ? (
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {writing.map((article) => (
                <HubTrackedLink key={article.slug} href={`/blog/${article.slug}`} eventName="click_hub_raul_articulo" destination={article.slug} className="hub-raul-card">
                  <h3 className="font-display text-2xl font-semibold text-nv-teal-deep">{article.title}</h3>
                  {article.excerpt ? <p className="mt-3 text-sm leading-6 text-neutral-700">{article.excerpt}</p> : null}
                </HubTrackedLink>
              ))}
            </div>
          ) : (
            <p className="mt-6 max-w-2xl text-neutral-700">La serie destacada y los artículos de Raúl se mostrarán aquí cuando estén publicados en la biblioteca.</p>
          )}
        </section>

        <section className="grid gap-8 rounded-nv border border-nv-teal-deep/20 bg-nv-cream-hi p-7 md:grid-cols-[180px_1fr] md:p-10" aria-labelledby="hub-quien-escribe">
          <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-nv-teal-deep text-6xl font-display text-nv-cream-hi">
            {profile?.user?.image ? <SafeAvatar src={profile.user.image} name={hub.nombre} alt="" className="h-full w-full object-cover" /> : "R"}
          </div>
          <div>
            <p className="hub-kicker">Quién escribe</p>
            <h2 id="hub-quien-escribe" className="hub-heading">{hub.nombre}</h2>
            <p className="mt-2 font-semibold text-nv-teal-deep">Psicólogo clínico y psicoanalista · CPPCR 8270 · UBA · desde 2007</p>
            <p className="mt-4 max-w-2xl leading-7 text-neutral-700">{profile?.profileReview || profile?.bio || "Un espacio de escucha clínica para poner en palabras lo que está ocurriendo."}</p>
            <Link href={hub.url_perfil} className="mt-5 inline-flex font-bold text-nv-teal-deep underline underline-offset-4">Ver perfil profesional →</Link>
          </div>
        </section>
      </div>

      <div className="container border-t border-nv-teal-deep/15 pt-6">
        <Link href="/ayuda-inmediata" className="text-sm font-bold text-nv-teal-deep underline underline-offset-4">Ayuda inmediata y líneas de apoyo</Link>
      </div>

      <div className="hub-mobile-actions md:hidden">
        <HubTrackedLink href={agendaUrl} eventName="click_hub_raul_agendar_mobile" destination="agenda-mobile" className="btn btn-accent flex-1">Agendar</HubTrackedLink>
        <HubTrackedAnchor href={waUrl} target="_blank" rel="noopener noreferrer" eventName="click_hub_raul_whatsapp_mobile" destination="whatsapp-mobile" className="btn flex-1 border border-nv-cream-hi/40 bg-nv-teal-deep text-nv-cream-hi">WhatsApp</HubTrackedAnchor>
      </div>
    </main>
  );
}
