import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { obtenerMiCaso } from "@/actions/caso-actions";
import { ESTADOS } from "@/lib/casos";
import CierreDeCasoForm from "@/components/casos/CierreDeCasoForm";
import NotaDeCierre from "@/components/casos/NotaDeCierre";
import AdendaForm from "@/components/casos/AdendaForm";

export const dynamic = "force-dynamic";

function fechaHora(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CasoPage({ params }) {
  // En Next 16 params es una promesa: leerla en forma síncrona devuelve undefined.
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "PROFESSIONAL") redirect("/");

  const { caso, contactosDeReenganche = 0, error } = await obtenerMiCaso(id);
  if (error && !caso) notFound();

  const abierto = caso.estado === ESTADOS.ABIERTO;
  const enVisado = caso.estado === ESTADOS.PENDIENTE_VISADO;
  const cerrado = caso.estado === ESTADOS.CERRADO;

  const observaciones = caso.notas.filter((n) => n.tipo === "OBSERVACION_DIRECCION");
  const adendas = caso.notas.filter((n) => n.tipo === "ADENDA");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <Link href="/panel/profesional/casos" className="text-sm text-brand-700 hover:underline">
        ← Todos los casos
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">{caso.pacienteNombre}</h1>
        <p className="mt-2 text-slate-600">
          Proceso abierto el{" "}
          {new Date(caso.abiertoAt).toLocaleDateString("es-CR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {caso.pacienteCedula ? ` · ${caso.pacienteCedula}` : ""}
        </p>
      </div>

      {enVisado ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
          <h2 className="font-semibold">Esperando el visado de la dirección clínica</h2>
          <p className="mt-1 text-sm">
            El cierre que propusiste está en revisión. Mientras tanto la persona no puede reservar
            con vos por su cuenta.
          </p>
        </div>
      ) : null}

      {/* Lo que la dirección clínica devolvió, si devolvió algo. Va arriba del
          formulario: es lo que hay que resolver antes de volver a proponer. */}
      {observaciones.length > 0 && !cerrado ? (
        <section className="rounded-2xl border border-brand-300 bg-brand-50 p-5">
          <h2 className="font-semibold text-brand-900">Observaciones de la dirección clínica</h2>
          <ul className="mt-3 space-y-3">
            {observaciones.map((nota) => (
              <li key={nota.id} className="text-sm text-brand-950">
                <p className="whitespace-pre-line leading-relaxed">{nota.texto}</p>
                <p className="mt-1 text-xs text-brand-700">{fechaHora(nota.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {abierto ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Cerrar el proceso</h2>
          <p className="mt-1 text-sm text-slate-600">
            Un alta o una baja son los dos momentos donde más se juega la continuidad de una
            persona. Por eso ninguno queda en firme sin pasar por la dirección clínica.
          </p>
          <div className="mt-5">
            <CierreDeCasoForm casoId={caso.id} contactosDeReenganche={contactosDeReenganche} />
          </div>
        </section>
      ) : (
        <NotaDeCierre caso={caso} />
      )}

      {cerrado ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Adendas</h2>
          <p className="mt-1 text-sm text-slate-600">
            La nota visada no se edita. Lo que haga falta corregir o ampliar se agrega acá, fechado.
          </p>

          {adendas.length > 0 ? (
            <ul className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              {adendas.map((nota) => (
                <li key={nota.id} className="text-sm text-slate-800">
                  <p className="whitespace-pre-line leading-relaxed">{nota.texto}</p>
                  <p className="mt-1 text-xs text-slate-500">{fechaHora(nota.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5">
            <AdendaForm casoId={caso.id} />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Bitácora</h2>
        <p className="mt-1 text-sm text-slate-600">
          Incluye cada acceso de la dirección clínica. Es lo que se le prometió a la persona en el
          acuerdo.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {caso.eventos.map((evento) => (
            <li key={evento.id} className="flex flex-wrap gap-x-3">
              <span className="font-mono text-xs text-slate-500">{fechaHora(evento.createdAt)}</span>
              <span className="font-semibold">{evento.tipo.replaceAll("_", " ").toLowerCase()}</span>
              {evento.detalle ? <span className="text-slate-600">— {evento.detalle}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
