"use client";

import { useState, useTransition } from "react";
import { AUDIENCIAS } from "@/lib/frases";
import { buscarEnCorpus, elegirFraseDelDia } from "@/actions/frases-actions";

/**
 * Sustitución: cuando ninguna candidata del día sirve para una audiencia, se
 * trae otra de las 1.112 del corpus. El corpus no viaja al navegador; la
 * búsqueda ocurre en el servidor y solo vuelven los resultados.
 *
 * Cada sustitución es para UNA audiencia concreta (las 8 deciden por
 * separado), así que hay que elegirla antes de poder usar un resultado.
 */
export default function PhraseSubstitute({ fecha, facetas, selecciones, audienciaInicial }) {
  const [pendiente, iniciar] = useTransition();
  const [resultados, setResultados] = useState([]);
  const [buscado, setBuscado] = useState(false);
  const [error, setError] = useState(null);
  const [audiencia, setAudiencia] = useState(audienciaInicial || "");
  const [filtros, setFiltros] = useState({
    texto: "",
    autor: "",
    tema: "",
    categoria: "",
    largoMaximo: "",
  });

  const eleccionActual = audiencia ? selecciones[audiencia] : null;

  function actualizar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  function buscar(evento) {
    evento.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await buscarEnCorpus(filtros);
      setResultados(r.resultados || []);
      setBuscado(true);
    });
  }

  function sustituir(indice) {
    if (!audiencia) {
      setError("Elegí primero para cuál audiencia es esta frase.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await elegirFraseDelDia({ fecha, indice, audiencia, sustituida: true });
      if (r?.error) setError(r.error);
    });
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
      <h2 className="text-lg font-bold text-brand-900">Sustituir por otra frase del corpus</h2>
      <p className="mt-1 text-sm text-neutral-650">
        1.112 frases de 40 autores. Filtrá por largo si la pieza va a historias: sobre 175
        caracteres se vuelve ilegible en ese formato.
      </p>

      <div className="mt-4 max-w-sm">
        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Audiencia destino</span>
          <select
            value={audiencia}
            onChange={(e) => setAudiencia(e.target.value)}
            className="mt-1 w-full rounded-lg border-neutral-300 text-sm"
          >
            <option value="">elegí una audiencia…</option>
            {AUDIENCIAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.label}
              </option>
            ))}
          </select>
        </label>
        {eleccionActual ? (
          <p className="mt-1 text-[11px] text-neutral-600">
            Ya tiene elegida: <span className="font-semibold">{eleccionActual.author}</span>
          </p>
        ) : null}
      </div>

      <form onSubmit={buscar} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Texto</span>
          <input
            type="text"
            value={filtros.texto}
            onChange={(e) => actualizar("texto", e.target.value)}
            placeholder="palabra o frase"
            className="mt-1 w-full rounded-lg border-neutral-300 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Autor</span>
          <input
            list="autores-corpus"
            type="text"
            value={filtros.autor}
            onChange={(e) => actualizar("autor", e.target.value)}
            className="mt-1 w-full rounded-lg border-neutral-300 text-sm"
          />
          <datalist id="autores-corpus">
            {facetas.autores.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Tema</span>
          <select
            value={filtros.tema}
            onChange={(e) => actualizar("tema", e.target.value)}
            className="mt-1 w-full rounded-lg border-neutral-300 text-sm"
          >
            <option value="">todos</option>
            {facetas.temas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Tono</span>
          <select
            value={filtros.categoria}
            onChange={(e) => actualizar("categoria", e.target.value)}
            className="mt-1 w-full rounded-lg border-neutral-300 text-sm"
          >
            <option value="">todos</option>
            {facetas.categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Largo máximo</span>
          <input
            type="number"
            min="40"
            max="250"
            value={filtros.largoMaximo}
            onChange={(e) => actualizar("largoMaximo", e.target.value)}
            placeholder="175"
            className="mt-1 w-full rounded-lg border-neutral-300 text-sm"
          />
        </label>

        <div className="sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {pendiente ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-3 rounded-lg border border-accent-500 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-950">
          {error}
        </p>
      ) : null}

      {buscado && resultados.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-700">Ninguna frase coincide con esos filtros.</p>
      ) : null}

      {resultados.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-neutral-600">
            {resultados.length} resultados {resultados.length === 40 ? "(máximo mostrado)" : ""}
          </p>
          {resultados.map((r) => {
            const yaElegida = eleccionActual?.phraseIndex === r.indice && eleccionActual?.status !== "SKIPPED";
            return (
              <div
                key={r.indice}
                className={`rounded-lg border px-4 py-3 ${
                  yaElegida ? "border-brand-500 bg-brand-50" : "border-neutral-200 bg-white"
                }`}
              >
                <p className="text-sm text-neutral-900">«{r.texto}»</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                  <span className="font-semibold text-neutral-800">{r.autor}</span>
                  <span className="italic">{r.obra}</span>
                  <span>
                    {r.categoria} · {r.largo} car.
                  </span>
                  {r.temas.length ? <span>{r.temas.join(", ")}</span> : null}
                  {r.verificada ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 font-bold text-brand-900">
                      fuente verificada
                    </span>
                  ) : (
                    <span className="rounded-full border border-accent-300 bg-accent-50 px-2 py-0.5 font-bold text-accent-950">
                      fuente sin verificar
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => sustituir(r.indice)}
                    disabled={pendiente || !audiencia || yaElegida}
                    title={!audiencia ? "Elegí primero la audiencia destino" : undefined}
                    className="ml-auto rounded-lg border border-neutral-300 px-3 py-1.5 font-semibold text-neutral-800 hover:border-brand-300 disabled:opacity-50"
                  >
                    {yaElegida ? "Ya elegida" : audiencia ? `Usar para ${audiencia}` : "Usar para este día"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
