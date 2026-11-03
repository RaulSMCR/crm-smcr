// src/app/ayuda/seguros/page.js — guía para pacientes con seguro PALIG.
// Pública a propósito: se le manda el enlace a quien todavía no tiene cuenta.
// Explica el flujo estandarizado del 2026-11-03: el paciente entrega su parte
// una vez y, con cada sesión pagada, recibe el formulario firmado y la factura.
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 86400;

export function generateMetadata() {
  return buildMetadata({
    title: "Seguro PALIG: cómo funciona el reclamo de tus sesiones",
    description:
      "Entregás una sola vez tu parte del formulario de reclamo de PALIG y, con cada sesión pagada, te llega el formulario firmado por tu profesional y la factura electrónica.",
    path: "ayuda/seguros",
  });
}

function Paso({ numero, titulo, children }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{numero}</span>
      <div>
        <h3 className="text-lg font-semibold text-neutral-900">{titulo}</h3>
        <div className="mt-1 space-y-2 leading-7 text-neutral-700">{children}</div>
      </div>
    </li>
  );
}

const PREGUNTAS = [
  ["¿Tengo que imprimir algo?", "No. Podés llenar y firmar tu parte en la pantalla. Si preferís el papel, también podés: lo llenás, lo firmás y subís una foto."],
  ["¿Qué necesito tener a mano?", "Tu carné del seguro, donde están el número de póliza y el de certificado, y el nombre de la empresa contratante (la empresa donde trabajás, o tu nombre si la póliza es personal)."],
  ["¿Y si cambian los datos de mi póliza?", "Volvé a entregar tu parte con los datos nuevos. El formulario se actualiza solo; tu profesional no tiene que repetir nada."],
  ["¿Quién firma si el paciente es menor de edad?", "La persona responsable, con su firma."],
  ["¿Cuándo me llega el formulario de cada sesión?", "Cuando se confirma el pago, tu profesional lo revisa y lo envía. Te llega a tu correo, junto con la factura electrónica en cuanto Hacienda la acepta."],
  ["¿Qué hago con el formulario y la factura?", "Presentalos a PALIG como indique tu póliza para el reintegro. Los documentos ya llevan la fecha de la sesión y la firma de tu profesional."],
  ["¿Quién ve mis datos?", "Tu formulario se guarda en archivos privados. Lo ven tu profesional y la administración de Salud Mental Costa Rica, para preparar tus reclamos."],
];

export default function AyudaSegurosPage() {
  return (
    <main className="bg-surface pb-20">
      <div className="container max-w-3xl py-12 md:py-20">
        <p className="hub-kicker">Ayuda</p>
        <h1 className="mt-2 font-display text-4xl font-light text-nv-teal-deep md:text-5xl">Seguro PALIG</h1>
        <p className="mt-5 text-lg leading-8 text-neutral-700">
          Si tu seguro médico es PALIG (Pan-American Life), te preparamos el formulario de reclamo de cada sesión. Vos
          entregás tu parte <strong>una sola vez</strong>; después, con cada sesión pagada, te llega todo listo para
          presentar.
        </p>

        <h2 className="mt-12 text-2xl font-semibold text-nv-teal-deep">Cómo funciona</h2>
        <ol className="mt-6 space-y-8">
          <Paso numero="1" titulo="Entregás tu parte, una sola vez">
            <p>
              Entrá a tu cuenta, en <strong>Seguro PALIG</strong>, y elegí cómo:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>En la pantalla:</strong> completás tus datos y los de tu póliza, leés la autorización de PALIG y
                firmás con el dedo.
              </li>
              <li>
                <strong>En papel:</strong> descargás el formulario, llenás solo la parte «A llenar por el asegurado», lo
                firmás y subís una foto de la hoja completa.
              </li>
            </ul>
            <p>
              <Link href="/mi/seguro" className="font-semibold text-brand-700 underline">
                Ir a Seguro PALIG
              </Link>{" "}
              (te pide iniciar sesión).
            </p>
          </Paso>
          <Paso numero="2" titulo="Tu profesional completa la suya">
            <p>
              Le avisamos y completa, también una sola vez, la parte que le toca: motivo de consulta, diagnóstico y
              tratamiento.
            </p>
          </Paso>
          <Paso numero="3" titulo="Con cada sesión pagada, te llega todo">
            <p>
              Cuando se confirma el pago, el formulario se arma con la fecha de esa sesión. Tu profesional lo firma, lo
              revisa y te lo envía por correo, junto con la factura electrónica.
            </p>
          </Paso>
          <Paso numero="4" titulo="Lo presentás a PALIG">
            <p>Con el formulario firmado y la factura, hacés el reclamo como indique tu póliza.</p>
          </Paso>
        </ol>

        <h2 className="mt-14 text-2xl font-semibold text-nv-teal-deep">Preguntas frecuentes</h2>
        <dl className="mt-6 space-y-6">
          {PREGUNTAS.map(([pregunta, respuesta]) => (
            <div key={pregunta}>
              <dt className="font-semibold text-neutral-900">{pregunta}</dt>
              <dd className="mt-1 leading-7 text-neutral-700">{respuesta}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-12 text-sm text-neutral-500">
          ¿Algo no te funcionó?{" "}
          <Link href="/contacto" className="underline">
            Escribinos
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
