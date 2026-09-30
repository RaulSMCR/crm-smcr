import Link from "next/link";
import { notFound } from "next/navigation";
import HubTracker from "@/components/hub/HubTracker";
import HubTrackedLink from "@/components/hub/HubTrackedLink";
import HubWhatsappLink from "@/components/hub/HubWhatsappLink";
import HubMobileActions from "@/components/hub/HubMobileActions";
import JsonLd from "@/components/JsonLd";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { buildMetadata, resolveSeo } from "@/lib/seo";
import { leerEncabezados } from "@/lib/hub-markdown";
import {
  RAUL_JOB_TITLE,
  buildWaLink,
  esquemaTemaHub,
  formatHubPrice,
  getManagedHubData,
  getPublishedHubTopicsAsync,
  getRaulAgenda,
  getRaulProfile,
  readManagedHubDocument,
} from "@/lib/hub-raul";

export const revalidate = 3600;

const SUBTITULO = "Raúl Olmedo Evans";

/** Lo mismo para el `<head>` y para el JSON-LD: la imagen del grafo es la de `og:image`. */
function seoDelTema(doc) {
  return resolveSeo(
    { metaTitle: doc.titulo_seo, metaDescription: doc.meta, ogImage: doc.ogImage, noindex: doc.noindex },
    { title: doc.titulo, description: doc.resumen, subtitle: SUBTITULO },
  );
}

/**
 * «14 de septiembre de 2026». En UTC porque la fecha del tema es solo día
 * (`2026-09-14`): leída en hora de Costa Rica caería en el 13.
 */
function fechaLarga(valor) {
  const fecha = valor ? new Date(valor) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return null;
  return {
    iso: fecha.toISOString().slice(0, 10),
    texto: new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(fecha),
  };
}

export async function generateStaticParams() {
  const topics = await getPublishedHubTopicsAsync();
  return topics.map((topic) => ({ tema: topic.slug }));
}

export async function generateMetadata({ params }) {
  const { tema } = await params;
  const doc = await readManagedHubDocument("raul-olmedo-evans", String(tema || ""));
  if (!doc) return { title: "Tema no encontrado", robots: { index: false, follow: false } };
  const seo = seoDelTema(doc);
  return buildMetadata({
    title: seo.title,
    description: seo.description,
    image: seo.image,
    imageAlt: seo.imageAlt,
    path: `raul-olmedo-evans/${tema}`,
    subtitle: SUBTITULO,
    type: "article",
    // Un tema sin cuerpo muestra "Estamos preparando esta página". Ofrecerlo al
    // índice es pedirle a Google que evalúe una página que dice no tener nada, y
    // pagar por un clic que aterriza ahí es peor todavía. Sigue navegable desde
    // el hub; deja de anunciarse. Vuelve al índice sola cuando tenga contenido.
    noindex: seo.noindex || !doc.body,
  });
}

export default async function RaulThemePage({ params }) {
  const { tema } = await params;
  const slug = String(tema || "");
  const [doc, hub] = await Promise.all([
    readManagedHubDocument("raul-olmedo-evans", slug),
    getManagedHubData(),
  ]);
  if (!doc || !hub) notFound();
  const [agenda, profile] = await Promise.all([getRaulAgenda(), getRaulProfile()]);
  const agendaUrl = agenda.url;
  // El precio sale de la tarifa aprobada, igual que en la portada del hub y en agendar.
  const precio = formatHubPrice(agenda.rango);
  const agendaEnabled = !hub.herramientas_habilitadas.length || hub.herramientas_habilitadas.includes("agenda");
  const whatsappEnabled = !hub.herramientas_habilitadas.length || hub.herramientas_habilitadas.includes("whatsapp");
  // El mensaje nombra el tema de donde sale el clic, así la conversación empieza
  // sabiendo qué se vino a consultar sin que el visitante tenga que explicarlo.
  const waUrl = buildWaLink(doc.titulo, hub);
  const schema = esquemaTemaHub({ hub, doc, slug, imagen: seoDelTema(doc).image, profile });
  const actualizado = fechaLarga(doc.actualizado || doc.fecha);

  // El índice sale de los `##` reales de la pieza. Si la pieza ya trae su propio
  // bloque «cuando-consultar», la caja genérica de la plantilla no se agrega: se
  // leían dos «Cuándo consultar» seguidos, con dos textos distintos. Las piezas
  // importadas antes de que existieran los marcadores (pánico, duelo) traen la
  // sección sin marcar y con la misma ancla que la caja: dos elementos con el
  // mismo `id`. Esa colisión también cuenta como «ya la trae».
  const encabezados = doc.body ? leerEncabezados(doc.body).filter((item) => item.nivel === 2) : [];
  const traeCuandoConsultar = encabezados.some((item) => item.bloque === "cuando-consultar" || item.id === "cuando-consultar");
  const cajaGenerica = Boolean(doc.body) && !traeCuandoConsultar;
  const indice = [
    ...encabezados.map((item) => ({ href: `#${item.id}`, texto: item.texto })),
    ...(cajaGenerica ? [{ href: "#cuando-consultar", texto: "Cuándo consultar" }] : []),
    ...(agendaEnabled ? [{ href: "#agendar", texto: "Agendar" }] : []),
  ];

  return (
    // `pb-32` en móvil y no `pb-20`: la barra fija de acciones tapaba el final
    // del artículo.
    <main className="bg-surface pb-32 md:pb-20">
      <JsonLd data={schema} />
      <HubTracker />
      <div className="container max-w-6xl py-12 md:py-20">
        <HubTrackedLink href="/raul-olmedo-evans" eventName="click_theme_hub" destination="hub" className="text-sm font-bold text-nv-teal-deep underline underline-offset-4">← Volver al hub de Raúl Olmedo Evans</HubTrackedLink>
        <div className="mt-8 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)_260px]">
          {indice.length ? (
            <nav aria-label="Índice de la página" className="hidden h-fit lg:sticky lg:top-28 lg:block">
              <p className="hub-kicker">En esta página</p>
              <ul className="mt-4 space-y-3 text-sm text-neutral-700">
                {indice.map((item, posicion) => (
                  <li key={`${item.href}-${posicion}`}><a href={item.href} className="hover:text-nv-teal-deep">{item.texto}</a></li>
                ))}
              </ul>
            </nav>
          ) : <div className="hidden lg:block" />}
          <article>
            <p className="hub-kicker">Tema de consulta</p>
            <h1 className="mt-2 font-display text-5xl font-light leading-tight text-nv-teal-deep">{doc.titulo}</h1>
            <p className="mt-5 text-lg leading-8 text-neutral-700">{doc.resumen}</p>
            {/* Quién escribe y con qué credencial, a la vista y no solo en el
                grafo: es contenido de salud, y lo primero que se evalúa es si
                quien lo firma puede verificarse. */}
            <p className="mt-4 text-sm leading-6 text-neutral-600">
              <Link href={hub.url_perfil} className="font-semibold text-nv-teal-deep underline underline-offset-4">{hub.nombre}</Link>
              {` · ${RAUL_JOB_TITLE}`}
              {hub.credencial?.numero ? (
                <>
                  {" · "}
                  {hub.credencial.url_verificacion ? (
                    <a href={hub.credencial.url_verificacion} target="_blank" rel="noopener noreferrer" title={`Verificar en el registro del ${hub.credencial.colegio}`} className="underline underline-offset-4">CPPCR {hub.credencial.numero}</a>
                  ) : `CPPCR ${hub.credencial.numero}`}
                </>
              ) : null}
              {actualizado ? <>{" · Actualizado el "}<time dateTime={actualizado.iso}>{actualizado.texto}</time></> : null}
            </p>
            {doc.body ? (
              <div className="prose prose-lg mt-10 max-w-none text-neutral-800">
                <MarkdownRenderer content={doc.body} idsEnEncabezados />
              </div>
            ) : (
              <div className="mt-10 rounded-nv border border-nv-teal-deep/20 bg-nv-cream-hi p-6">
                <p className="hub-kicker">Tema en preparación</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-nv-teal-deep">Estamos preparando esta página</h2>
                <p className="mt-3 leading-7 text-neutral-700">El contenido de este tema se incorporará próximamente. Si querés conversar sobre tu situación, podés solicitar una cita.</p>
              </div>
            )}
            {cajaGenerica ? (
            <section id="cuando-consultar" className="mt-10 rounded-nv border-l-4 border-nv-teal-mid bg-nv-cream-hi p-6">
              <h2 className="font-display text-3xl font-semibold text-nv-teal-deep">Cuándo consultar</h2>
              <p className="mt-3 leading-7 text-neutral-700">Podés consultar cuando el malestar se repite, limita tu vida cotidiana o querés comprenderlo con acompañamiento clínico. Si hay peligro inmediato, dirigite a <Link href="/ayuda-inmediata" className="font-bold underline">ayuda inmediata</Link>.</p>
            </section>
            ) : null}
          </article>
          {agendaEnabled ? <aside id="agendar" className="h-fit rounded-nv border border-nv-teal-deep/20 bg-nv-cream-hi p-6 lg:sticky lg:top-28">
            <p className="hub-kicker">Un siguiente paso</p>
            <h2 className="mt-2 font-display text-3xl text-nv-teal-deep">Hablarlo en consulta</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-700">La primera conversación permite ubicar qué está ocurriendo y qué tipo de trabajo puede tener sentido.</p>
            <p className="mt-3 text-sm font-semibold text-nv-teal-deep">Sesión en línea de {hub.duracion_min} minutos{precio ? ` · ${precio}` : ""}</p>
            <HubTrackedLink href={agendaUrl} eventName="click_theme_agendar" destination={slug} className="btn btn-accent mt-6 w-full">Agendar sesión</HubTrackedLink>
            {whatsappEnabled ? <HubWhatsappLink href={waUrl} ubicacion="cierre" tema={slug} className="mt-4 block text-center text-sm font-bold text-nv-teal-deep underline decoration-nv-coral underline-offset-4">o escribí para agendar tu sesión paga</HubWhatsappLink> : null}
            <HubTrackedLink href="/raul-olmedo-evans/tratamiento-breve-15-sesiones" eventName="click_theme_15_sesiones" destination="tratamiento-breve-15-sesiones" className="mt-4 block text-center text-sm font-bold text-nv-teal-deep underline underline-offset-4">Ver formato de 15 sesiones</HubTrackedLink>
          </aside> : null}
        </div>
      </div>

      <HubMobileActions
        agendaUrl={agendaUrl}
        waUrl={waUrl}
        tema={slug}
        agendaEnabled={agendaEnabled}
        whatsappEnabled={whatsappEnabled}
      />
    </main>
  );
}
