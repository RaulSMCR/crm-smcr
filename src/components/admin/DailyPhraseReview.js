"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
// Desde frases-audiencia y no desde frases: este último importa los 300 KB del
// corpus y los arrastraría al bundle del navegador.
import { AUDIENCIAS } from "@/lib/frases-audiencia";
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

/**
 * Ocho chips, una por audiencia, para ver de un vistazo cuáles ya tienen frase
 * elegida hoy. Cada radio del bloque de abajo pertenece a UNA audiencia: el
 * bug que reportó Raúl era que las 16 candidatas del día compartían un solo
 * grupo de radio (y una sola fila en base de datos), así que elegir la de una
 * audiencia pisaba la de las otras 7.
 */
function ProgresoAudiencias({ selecciones }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {AUDIENCIAS.map((a) => {
        const pick = selecciones[a.id];
        const decidida = Boolean(pick);
        const omitida = pick?.status === "SKIPPED";
        return (
          <span
            key={a.id}
            title={a.label}
            className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
              omitida
                ? "bg-neutral-200 text-neutral-600"
                : decidida
                  ? "bg-brand-700 text-white"
                  : "border border-neutral-300 bg-white text-neutral-500"
            }`}
          >
            {a.id} {omitida ? "—" : decidida ? "✓" : "·"}
          </span>
        );
      })}
    </div>
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
          name={`frase-${candidata.audiencia}`}
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

function BloqueAudiencia({ fecha, audiencia, candidatas, seleccion, verificaciones, pendiente, onElegir, onReabrir }) {
  const [abierto, setAbierto] = useState(!seleccion);
  const indiceElegido = seleccion && seleccion.status !== "SKIPPED" ? seleccion.phraseIndex : null;
  const omitida = seleccion?.status === "SKIPPED";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-bold uppercase tracking-[0.08em] text-neutral-800">
            {audiencia.id}
          </span>
          <span className="text-xs text-neutral-600">{audiencia.label}</span>
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold">
          {omitida ? (
            <span className="text-neutral-500">sin publicación</span>
          ) : seleccion ? (
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                ✓ guardada
              </span>
              <span className="text-brand-800">{seleccion.author}</span>
            </span>
          ) : (
            <span className="rounded-full border border-accent-400 px-2 py-0.5 text-accent-950">
              sin elegir
            </span>
          )}
          <span className="text-neutral-400">{abierto ? "▲" : "▼"}</span>
        </span>
      </button>

      {abierto ? (
        <div className="mt-3 space-y-2">
          {seleccion && !omitida ? (
            <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[11px] text-brand-900">
              <strong>Guardada</strong>
              {seleccion.guardadaEl ? ` el ${seleccion.guardadaEl}` : ""}
              {seleccion.status === "SUBSTITUTED" ? " · traída del corpus" : " · de las candidatas del día"}
              . Elegir otra la reemplaza; no hace falta confirmar nada más.
              {seleccion.fraseHuerfana
                ? " Ojo: esta frase ya no existe en el corpus vigente, se conserva el texto guardado."
                : ""}
            </p>
          ) : null}

          {omitida ? (
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-700">Esta audiencia quedó sin publicación.</span>
              <button
                type="button"
                onClick={() => onReabrir(audiencia.id)}
                disabled={pendiente}
                className="rounded-lg border border-neutral-300 px-2 py-1 text-[11px] font-semibold text-neutral-800 hover:border-brand-300 disabled:opacity-50"
              >
                Reabrir
              </button>
            </div>
          ) : (
            candidatas.map((candidata) => (
              <Candidata
                key={candidata.slot}
                candidata={candidata}
                elegida={indiceElegido === candidata.indice}
                verificada={Boolean(verificaciones[candidata.claveFuente])}
                deshabilitado={pendiente}
                onElegir={() => onElegir(candidata)}
              />
            ))
          )}

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/panel/admin/frases?fecha=${fecha}&audiencia=${audiencia.id}`}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-800 hover:border-brand-300"
            >
              Sustituir por otra del corpus
            </Link>
            {!omitida ? (
              <button
                type="button"
                onClick={() => onReabrir(audiencia.id)}
                disabled={pendiente || !seleccion}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 hover:border-accent-300 disabled:opacity-50 disabled:hover:border-neutral-300"
              >
                Quitar elección
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DiaPendiente({ dia, verificaciones, compacto }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState(null);
  const { resumen, candidatas, selecciones, decididas, totalAudiencias } = dia;

  const todasOmitidas =
    decididas === totalAudiencias &&
    Object.values(selecciones).every((s) => s.status === "SKIPPED");

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

  function omitirTodo() {
    setError(null);
    iniciar(async () => {
      const r = await omitirDia({ fecha: dia.fecha });
      if (r?.error) setError(r.error);
    });
  }

  function reabrir(audienciaId) {
    setError(null);
    iniciar(async () => {
      const r = await reabrirDia(dia.fecha, audienciaId);
      if (r?.error) setError(r.error);
    });
  }

  const porAudiencia = new Map();
  for (const c of candidatas) {
    if (!porAudiencia.has(c.audiencia)) porAudiencia.set(c.audiencia, []);
    porAudiencia.get(c.audiencia).push(c);
  }

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
            <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
              {decididas}/{totalAudiencias} audiencias
            </span>
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

      <div className="mt-3">
        <ProgresoAudiencias selecciones={selecciones} />
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

      {todasOmitidas ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-3">
          <span className="text-sm font-semibold text-neutral-800">
            Este día quedó marcado sin publicación para las {totalAudiencias} audiencias.
          </span>
          <button
            type="button"
            onClick={() => reabrir()}
            disabled={pendiente}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:border-brand-300 disabled:opacity-50"
          >
            Reabrir todo el día
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {AUDIENCIAS.map((audiencia) => (
              <BloqueAudiencia
                key={audiencia.id}
                fecha={dia.fecha}
                audiencia={audiencia}
                candidatas={porAudiencia.get(audiencia.id) || []}
                seleccion={selecciones[audiencia.id] || null}
                verificaciones={verificaciones}
                pendiente={pendiente}
                onElegir={elegir}
                onReabrir={(audId) => reabrir(audId)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={omitirTodo}
              disabled={pendiente}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-accent-300 disabled:opacity-50"
            >
              No publicar ninguna audiencia hoy
            </button>
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
            Cada una de las 8 audiencias elige su propia frase. Se trabaja con un día de
            anticipación; el viernes cubre sábado, domingo y lunes.
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
