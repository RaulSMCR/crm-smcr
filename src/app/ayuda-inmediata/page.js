import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { grafo, nodoMigas } from "@/lib/jsonld";
import { getCrisisData } from "@/lib/hub-raul";
import { buildMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 86400;

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
        <Link href="/raul-olmedo" className="text-sm font-bold text-nv-teal-deep underline underline-offset-4">← Volver al hub de Raúl</Link>
        <p className="hub-kicker mt-10">Apoyo y emergencia</p>
        <h1 className="mt-2 font-display text-5xl font-light text-nv-teal-deep">Ayuda inmediata</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-700">Esta página reúne recursos para cuando necesitás una respuesta inmediata. No reemplaza la atención de emergencias ni una evaluación profesional.</p>
        <div className="mt-10 space-y-4">
          {data.lineas.map((linea) => (
            <section key={linea.numero} className="rounded-nv border border-nv-teal-deep/20 bg-nv-cream-hi p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-3xl text-nv-teal-deep">{linea.nombre}</h2>
                <p className="text-2xl font-bold text-nv-teal-deep">{linea.numero}</p>
              </div>
              <p className="mt-3 leading-7 text-neutral-700">{linea.detalle}</p>
              <p className="mt-2 text-sm text-neutral-600">Horario: {linea.horario}</p>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-neutral-600">Última verificación: {data.ultima_verificacion}</p>
      </div>
    </main>
  );
}
