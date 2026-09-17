import JsonLd from "@/components/JsonLd";
import { grafo, nodoMigas } from "@/lib/jsonld";
import { getCrisisData } from "@/lib/hub-raul";
import { buildMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 86400;

/**
 * Un horario que nadie verificó no se publica.
 *
 * La página servía «Horario: Por completar» junto al 800 del Colegio. En una
 * página de crisis eso no es un pendiente de trabajo a la vista: le dice a
 * quien está mal que no sabemos si esa línea atiende. Se omite el renglón, que
 * es lo mismo que hace el sitemap con `lastModified` cuando no tiene una fecha
 * real detrás —omitir el campo es información; inventarlo es ruido—.
 *
 * El filtro ataja marcadores además del vacío porque el dato se edita a mano en
 * data/crisis-lines.json y el próximo pendiente puede escribirse distinto.
 */
const MARCADORES = new Set(["por completar", "por confirmar", "pendiente", "tbd", "-", "--", "—", "n/a"]);

function horarioPublicable(horario) {
  const texto = String(horario || "").trim();
  return texto && !MARCADORES.has(texto.toLowerCase()) ? texto : null;
}

/**
 * El número marcable, sin separadores.
 *
 * Estaba impreso como texto plano: en una página de crisis abierta en un
 * teléfono, el número que hay que llamar no se podía llamar. Se muestra igual
 * que antes —con el guion, que es como se lee— y se marca sin él.
 */
function tel(numero) {
  return `tel:${String(numero || "").replace(/[^0-9+]/g, "")}`;
}

export function generateMetadata() {
  return buildMetadata({
    title: "Ayuda inmediata y líneas de apoyo",
    description: "Recursos de emergencia y líneas de apoyo en Costa Rica para situaciones de riesgo o crisis.",
    path: "ayuda-inmediata",
  });
}

export default function AyudaInmediataPage() {
  const data = getCrisisData();
  const url = siteUrl("ayuda-inmediata");
  return (
    <main className="bg-surface pb-20">
      <JsonLd data={grafo({ "@type": "WebPage", "@id": url, url, name: "Ayuda inmediata y líneas de apoyo" }, nodoMigas([{ nombre: "Ayuda inmediata", url }]))} />
      <div className="container max-w-4xl py-12 md:py-20">
        {/* Esta página se enlaza ahora desde el pie de todo el sitio, así que
            deja de encabezarse con «volver al hub de Raúl Olmedo Evans»: quien
            llega desde un artículo de la biblioteca no venía de ahí. El hub y
            sus temas siguen enlazando hacia acá. */}
        <p className="hub-kicker">Apoyo y emergencia</p>
        <h1 className="mt-2 font-display text-5xl font-light text-nv-teal-deep">Ayuda inmediata</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-700">Esta página reúne recursos para cuando necesitás una respuesta inmediata. No reemplaza la atención de emergencias ni una evaluación profesional.</p>
        <div className="mt-10 space-y-4">
          {data.lineas.map((linea) => {
            const horario = horarioPublicable(linea.horario);
            return (
            <section key={linea.numero} className="rounded-nv border border-nv-teal-deep/20 bg-nv-cream-hi p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-3xl text-nv-teal-deep">{linea.nombre}</h2>
                <a
                  href={tel(linea.numero)}
                  aria-label={`Llamar a ${linea.nombre}, ${linea.numero}`}
                  className="text-2xl font-bold text-nv-teal-deep underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nv-teal-deep"
                >
                  {linea.numero}
                </a>
              </div>
              <p className="mt-3 leading-7 text-neutral-700">{linea.detalle}</p>
              {horario ? <p className="mt-2 text-sm text-neutral-600">Horario: {horario}</p> : null}
            </section>
            );
          })}
        </div>
        <p className="mt-8 text-sm text-neutral-600">Última verificación: {data.ultima_verificacion}</p>
      </div>
    </main>
  );
}
