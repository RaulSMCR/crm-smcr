"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { elegirFraseDelDia, omitirDia, reabrirDia } from "@/actions/frases-actions";

// Escala de calor 0–10. Un solo tono, como el mapa térmico: globals.css aplasta
// con !important las variantes de bg-red-* y bg-green-*, así que una rampa
// verde→rojo saldría plana.
function claseCalor(calor) {
  if (calor >= 9) return "bg-accent-700 text-white";
  if (calor >= 8) return "bg-accent-500 text-white";
  if (calor >= 7) return "bg-accent-300 text-accent-950";
  if (calor >= 6) return "bg-accent-100 text-accent-950";
  return "bg-neutral-100 text-neutral-700";
}

function BarraCalor({ calor }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${claseCalor(calor)}`}>
        {calor}/10
      </span>
      <span className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-1 rounded-sm ${i < calor ? "bg-accent-500" : "bg-neutral-200"}`}
          />
        ))}
      </span>
    </span>
  );
}

function Candidata({ candidata, elegida, verificada, onElegir, deshabilitado }) {
  return (
    <label
      className={`block cursor-pointer rounded-lg border px-4 py-3 transition ${
        elegida
          ? "border-brand-500 bg-brand-50"
          : "border-neutral-200 bg-white hover:border-brand-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="radio"
          name="frase-elegida"
          checked={elegida}
          disabled={deshabilitado}
          onChange={onElegir}
          className="mt-1 h-4 w-4 border-neutral-300 text-brand-700 focus:ring-brand-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
              {candidata.audiencia}
            </span>
            <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
              {candidata.rol}
            </span>
            <span className="text-[10px] font-semibold text-neutral-500">
              {candidata.categoria} · {candidata.largo} car.
            </span>
            {candidata.largo > 175 ? (
              <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-950">
                larga para historias
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-neutral-900">«{candidata.texto}»</p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
            <span className="font-semibold text-neutral-800">{candidata.autor}</span>
            <span className="italic">{candidata.obra}</span>
            {verificada ? (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 font-bold text-brand-900">
                fuente verificada
              </span>
            ) : (
              <span
                className="rounded-full border border-accent-300 bg-accent-50 px-2 py-0.5 font-bold text-accent-950"
                title="El corpus advierte que hay referencias a obras inexistentes y glosas presentadas como citas literales. Sin verificar no se puede generar la placa de redes."
              >
                fuente sin verificar
              </span>
            )}
            <span className="text-neutral-500">{candidata.audienciaLabel}</span>
          </div>
        </div>
      </div>
    </label>
  );
}

function DiaPendiente({ dia, verificaciones, compacto }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState(null);
  const [verTodas, setVerTodas] = useState(false);
  const { resumen, candidatas, seleccion } = dia;

  const indiceElegido = seleccion?.status === "SKIPPED" ? null : seleccion?.phraseIndex ?? null;
  const omitido = seleccion?.status === "SKIPPED";

  function elegir(candidata) {
    setError(null);
    iniciar(async () => {
      const r = await elegirFraseDelDia({
        fecha: dia.fecha,
        indice: candidata.indice,
        audiencia: candidata.audiencia,
        slot: candidata.slot,
      });
      if (r?.error) setError(r.error);
    });
  }

  function omitir() {
    setError(null);
    iniciar(async () => {
      const r = await omitirDia({ fecha: dia.fecha });
      if (r?.error) setError(r.error);
    });
  }

  function reabrir() {
    setError(null);
    iniciar(async () => {
      const r = await reabrirDia(dia.fecha);
      if (r?.error) setError(r.error);
    });
  }

  // En días de mucha exposición conviene ver las 16; en el resto, las 6 primeras
  // alcanzan para decidir sin tener que barrer toda la lista.
  const limite = verTodas || resumen.calor >= 9 ? candidatas.length : 6;
  const visibles = candidatas.slice(0, limite);

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-brand-900">
              {resumen.diaSemana} {dia.fecha}
            </h3>
            {dia.atrasada ? (
              <span className="rounded-full bg-accent-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                atrasada
              </span>
            ) : null}
            {dia.enVivo ? (
              <span className="rounded-full border border-accent-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-accent-950">
                ya en vivo
              </span>
            ) : null}
            {resumen.ventanaSensible ? (
              <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-accent-950">
                ventana sensible
              </span>
            ) : null}
          </div>
          {resumen.evento ? (
            <p className="mt-1 text-sm font-semibold text-neutral-800">{resumen.evento}</p>
          ) : null}
          <p className="mt-1 text-xs text-neutral-600">
            Temas del día: {resumen.temasDominantes.join(" · ")}
          </p>
          {resumen.vector ? (
            <p className="mt-1 max-w-3xl text-xs text-neutral-700">{resumen.vector}</p>
          ) : null}
        </div>
        <BarraCalor calor={resumen.calor} />
      </div>

      {resumen.ventanaSensible ? (
        <p className="mt-3 rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-950">
          Regla de ventana sensible: ninguna pieza debe cerrar en imperativo de rendimiento
          («superate», «no te rindás»). En estos días el imperativo se lee como reproche.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-accent-500 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-950">
          {error}
        </p>
      ) : null}

      {omitido ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-3">
          <span className="text-sm font-semibold text-neutral-800">
            Este día quedó marcado sin publicación.
          </span>
          <button
            type="button"
            onClick={reabrir}
            disabled={pendiente}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:border-brand-300 disabled:opacity-50"
          >
            Reabrir
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {visibles.map((candidata) => (
              <Candidata
                key={`${candidata.audiencia}-${candidata.slot}`}
                candidata={candidata}
                elegida={indiceElegido === candidata.indice}
                verificada={Boolean(verificaciones[candidata.claveFuente])}
                deshabilitado={pendiente}
                onElegir={() => elegir(candidata)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {limite < candidatas.length ? (
              <button
                type="button"
                onClick={() => setVerTodas(true)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:border-brand-300"
              >
                Ver las {candidatas.length} candidatas
              </button>
            ) : null}
            <Link
              href={`/panel/admin/frases?fecha=${dia.fecha}`}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:border-brand-300"
            >
              Sustituir por otra del corpus
            </Link>
            <button
              type="button"
              onClick={omitir}
              disabled={pendiente}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-accent-300 disabled:opacity-50"
            >
              No publicar este día
            </button>
            {seleccion && !omitido ? (
              <span className="text-xs font-semibold text-brand-800">
                Elegida: {seleccion.author}
                {seleccion.status === "SUBSTITUTED" ? " · sustituida" : ""}
              </span>
            ) : null}
          </div>
        </>
      )}

      {compacto ? null : (
        <p className="mt-3 text-[11px] text-neutral-500">
          Se decide en la sesión del {dia.sesion}. La frase entra en vivo a las 6:00.
        </p>
      )}
    </section>
  );
}

export default function DailyPhraseReview({ sesion, verificaciones, compacto = false }) {
  if (!sesion.pendientes.length) {
    return (
      <section className="rounded-lg border border-brand-200 bg-brand-50 p-5">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
          Frase diaria
        </div>
        <p className="mt-1 text-sm text-brand-950">
          {sesion.antesDeEmpezar
            ? `El calendario de frases arranca el ${sesion.primerDia}. Hasta entonces no hay nada que decidir; la primera sesión cae el día hábil anterior.`
            : sesion.despuesDelFinal
              ? `El corpus llegó a su último día (${sesion.ultimoDia}). Hace falta material nuevo para seguir publicando.`
              : `No hay días pendientes. La próxima sesión de revisión cubre ${
                  sesion.objetivoDeHoy.length
                    ? sesion.objetivoDeHoy.join(", ")
                    : "el próximo día hábil"
                }.`}
        </p>
        <Link
          href="/panel/admin/frases"
          className="mt-3 inline-block rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-100"
        >
          Ir al control de frases
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
            Frase diaria · {sesion.pendientes.length}{" "}
            {sesion.pendientes.length === 1 ? "día por decidir" : "días por decidir"}
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            Se trabaja con un día de anticipación; el viernes cubre sábado, domingo y lunes.
            {sesion.atrasadas > 0
              ? ` Hay ${sesion.atrasadas} ${sesion.atrasadas === 1 ? "día atrasado" : "días atrasados"}.`
              : ""}
          </p>
        </div>
        <Link
          href="/panel/admin/frases"
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:border-brand-300"
        >
          Control de frases
        </Link>
      </div>

      {sesion.pendientes.map((dia) => (
        <DiaPendiente
          key={dia.fecha}
          dia={dia}
          verificaciones={verificaciones}
          compacto={compacto}
        />
      ))}
    </div>
  );
}
