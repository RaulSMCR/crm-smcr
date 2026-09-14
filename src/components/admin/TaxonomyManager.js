"use client";

// src/components/admin/TaxonomyManager.js
//
// La versión anterior era correcta y no se entendía. Mostraba cinco listas de
// nombres con un contador «N art.» cada una, y nada más: ni qué era cada lista,
// ni dónde se veía en el sitio, ni que el contador no coincidía con lo público,
// ni que los cambios se guardaban solos al salir del campo, ni que renombrar
// cambia la dirección de la página. Todo eso había que saberlo de antes.
//
// Acá se dice. Cada bloque explica qué es y dónde aparece; cada fila dice su
// estado real y enlaza a su página; las series muestran sus entregas y qué les
// falta; y lo que no se puede deshacer avisa antes.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createDiscipline, updateDiscipline, deleteDiscipline,
  createTopic, updateTopic, deleteTopic,
  createPhase, updatePhase, deletePhase,
  createSeries, updateSeries, deleteSeries,
  linkComplementaryTopics, unlinkComplementaryTopics,
} from "@/actions/taxonomy-actions";
import {
  TONO,
  avisoDeOrden,
  avisoDeRenombrado,
  estadoDeDisciplina,
  estadoDeEntrega,
  estadoDeFase,
  estadoDeSerie,
  estadoDeTema,
} from "@/lib/taxonomia-estado";

const COLOR_TONO = {
  [TONO.VISIBLE]: "border-emerald-300 bg-emerald-50 text-emerald-800",
  [TONO.PENDIENTE]: "border-amber-300 bg-amber-50 text-amber-900",
  [TONO.OCULTO]: "border-slate-300 bg-slate-100 text-slate-500",
  [TONO.NEUTRO]: "border-slate-300 bg-white text-slate-600",
};

function useAccion() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState(false);

  // El guardado al salir del campo no daba ninguna señal: se escribía, se hacía
  // clic afuera y la pantalla no decía nada. Sin confirmación no hay forma de
  // distinguir «se guardó» de «no se enteró».
  const run = (fn) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) return setError(res.error);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
      router.refresh();
    });
  };
  return { pending, error, guardado, run };
}

function Estado({ estado }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${COLOR_TONO[estado.tono]}`}>
      {estado.etiqueta}
    </span>
  );
}

function AvisoGuardado({ pending, guardado, error }) {
  if (error) return <p className="text-sm font-semibold text-red-600">{error}</p>;
  if (pending) return <p className="text-xs text-slate-500">Guardando…</p>;
  if (guardado) return <p className="text-xs font-semibold text-emerald-700">Guardado</p>;
  return null;
}

/**
 * Encabezado de un bloque: qué es, un ejemplo y dónde se ve en el sitio.
 * El ejemplo hace más que la definición — «Duelo» explica qué es un tema mejor
 * que cualquier frase sobre ejes transversales.
 */
function Encabezado({ titulo, queEs, ejemplo, dondeSeVe }) {
  return (
    <div className="border-b border-slate-100 pb-3">
      <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
      <p className="mt-1 text-sm text-slate-600">{queEs}</p>
      <dl className="mt-2 space-y-1 text-xs text-slate-500">
        {ejemplo ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">Por ejemplo:</dt>
            <dd>{ejemplo}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold text-slate-600">En el sitio:</dt>
          <dd>{dondeSeVe}</dd>
        </div>
      </dl>
    </div>
  );
}

function Fila({ termino, estado, urlPublica, tienePaginaPublica, onRename, onToggle, onDelete, textoEliminar, extra, children }) {
  const { pending, error, guardado, run } = useAccion();
  const activo = termino.isActive !== false;

  function renombrar(valor) {
    const nuevo = valor.trim();
    if (!nuevo || nuevo === termino.name) return;
    const aviso = avisoDeRenombrado(termino.name, nuevo, {
      tienePaginaPublica,
      esVisible: estado.tono === TONO.VISIBLE,
    });
    if (aviso && !confirm(aviso)) return;
    run(() => onRename(termino.id, { name: nuevo }));
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          defaultValue={termino.name}
          onBlur={(e) => renombrar(e.target.value)}
          aria-label={`Nombre de ${termino.name}`}
          className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm font-semibold text-slate-900 hover:border-slate-300 focus:border-brand-400 focus:bg-white focus:outline-none"
        />
        <Estado estado={estado} />
        <button
          type="button"
          onClick={() => run(() => onToggle(termino.id, { isActive: !activo }))}
          disabled={pending}
          className={`rounded-nv border px-2 py-1 text-xs font-semibold disabled:opacity-50 ${activo ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-300 bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          title={activo ? "Deja de mostrarse en el sitio. No se borra nada y se puede revertir." : "Vuelve a mostrarse en el sitio."}
        >
          {activo ? "Ocultar" : "Mostrar"}
        </button>
        <button
          type="button"
          onClick={() => { if (confirm(textoEliminar)) run(() => onDelete(termino.id)); }}
          disabled={pending}
          className="rounded-nv border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-2">
        <p className="text-xs text-slate-500">{estado.explicacion}</p>
        <AvisoGuardado pending={pending} guardado={guardado} error={error} />
      </div>

      {urlPublica ? (
        <p className="mt-1 pl-2 text-xs">
          <a href={urlPublica} target="_blank" rel="noopener noreferrer" className="font-mono text-slate-500 underline decoration-slate-300 hover:text-brand-700">
            {urlPublica}
          </a>
        </p>
      ) : null}

      {extra}
      {children}
    </li>
  );
}

// ─── Disciplinas, temas y fases: mismo formulario, distinta explicación ──────

function SeccionTerminos({ titulo, queEs, ejemplo, dondeSeVe, placeholder, terminos, calcularEstado, urlDe, tienePaginaPublica, textoEliminar, notaExtra, onCreate, onRename, onToggle, onDelete, vacio }) {
  const { pending, error, run } = useAccion();
  const [name, setName] = useState("");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <Encabezado titulo={titulo} queEs={queEs} ejemplo={ejemplo} dondeSeVe={dondeSeVe} />

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) { run(() => onCreate(name.trim())); setName(""); } }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className="input flex-1" />
        <button type="submit" disabled={pending} className="btn btn-accent disabled:opacity-60">Agregar</button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <ul className="mt-2 divide-y divide-slate-100">
        {terminos.map((t) => (
          <Fila
            key={t.id}
            termino={t}
            estado={calcularEstado(t)}
            urlPublica={urlDe ? urlDe(t) : null}
            tienePaginaPublica={tienePaginaPublica}
            onRename={onRename}
            onToggle={onToggle}
            onDelete={onDelete}
            textoEliminar={textoEliminar(t)}
            extra={notaExtra ? notaExtra(t) : null}
          />
        ))}
        {terminos.length === 0 ? <li className="py-3 text-sm text-slate-500">{vacio}</li> : null}
      </ul>
    </section>
  );
}

// ─── Series ─────────────────────────────────────────────────────────────────

function Entregas({ serie }) {
  const entregas = serie.entregas || [];
  const aviso = avisoDeOrden(entregas);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Artículos de esta serie</p>

      {entregas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          Ninguno todavía. Se asignan desde el artículo:{" "}
          <Link href="/panel/admin/blog" className="font-semibold text-brand-700 underline">abrilo en Gestión editorial</Link>{" "}
          y buscá el recuadro «Orden de lectura por series».
        </p>
      ) : (
        <ol className="mt-2 space-y-1">
          {entregas.map((entrega) => {
            const estado = estadoDeEntrega(entrega);
            return (
              <li key={entrega.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-6 shrink-0 text-right font-mono text-xs text-slate-500">{entrega.seriesOrder ?? "—"}</span>
                <Link href={`/panel/admin/blog/${entrega.id}`} className="min-w-0 flex-1 truncate text-slate-800 underline decoration-slate-300 hover:text-brand-700">
                  {entrega.title}
                </Link>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${COLOR_TONO[estado.tono]}`} title={estado.explicacion}>
                  {estado.etiqueta}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {aviso ? <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{aviso}</p> : null}

      {entregas.some((e) => e.status === "PUBLISHED" && e.seriesApproved !== true) ? (
        <p className="mt-2 text-xs text-slate-600">
          Para aprobar una entrega marcada «Serie sin aprobar»: abrí el artículo y volvé a guardar el
          recuadro «Orden de lectura por series». Guardarlo como administrador ya la aprueba.
        </p>
      ) : null}
    </div>
  );
}

function SeccionSeries({ series, phases }) {
  const { pending, error, run } = useAccion();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <Encabezado
        titulo="Series"
        queEs="Varios artículos que se leen en orden, como capítulos. Cada serie tiene su propia página con las entregas numeradas."
        ejemplo="«La angustia y sus formas», con sus entregas 1, 2 y 3."
        dondeSeVe="Página propia en /blog/serie/…, filtro en la biblioteca y enlace al pie de cada artículo de la serie."
      />

      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) { run(() => createSeries(name.trim(), description.trim())); setName(""); setDescription(""); } }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la serie — por ejemplo: La angustia y sus formas" className="input w-full" />
        <div className="flex flex-wrap gap-2">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Una línea que diga de qué trata (opcional, sale bajo el título)" className="input min-w-0 flex-1" />
          <button type="submit" disabled={pending} className="btn btn-accent disabled:opacity-60">Agregar</button>
        </div>
        <p className="text-xs text-slate-500">
          El nombre define la dirección de la página, así que conviene dejarlo escrito como va a
          quedar: cambiarlo después rompe los enlaces que ya apunten a ella.
        </p>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <ul className="mt-2 divide-y divide-slate-100">
        {series.map((s) => (
          <Fila
            key={s.id}
            termino={s}
            estado={estadoDeSerie(s)}
            urlPublica={`/blog/serie/${s.slug}`}
            tienePaginaPublica
            onRename={updateSeries}
            onToggle={updateSeries}
            onDelete={deleteSeries}
            textoEliminar={`¿Eliminar la serie «${s.name}»?\n\nLos artículos no se borran: quedan sueltos en la biblioteca, sin orden de lectura. La dirección /blog/serie/${s.slug} deja de existir.`}
            extra={<DetalleSerie serie={s} phases={phases} />}
          />
        ))}
        {series.length === 0 ? (
          <li className="py-3 text-sm text-slate-500">Todavía no hay series. Creá una arriba y después asignale artículos.</li>
        ) : null}
      </ul>
    </section>
  );
}

/** Descripción editable, fase, y la lista de entregas de una serie. */
function DetalleSerie({ serie, phases }) {
  const { pending, error, guardado, run } = useAccion();

  return (
    <div className="mt-2 pl-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          defaultValue={serie.description || ""}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (serie.description || "")) run(() => updateSeries(serie.id, { description: v })); }}
          placeholder="Sin descripción — se muestra bajo el título de la serie"
          aria-label={`Descripción de ${serie.name}`}
          className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm text-slate-600 hover:border-slate-300 focus:border-brand-400 focus:bg-white focus:outline-none"
        />
        {phases.length ? (
          <select
            value={serie.phaseId || ""}
            onChange={(e) => run(() => updateSeries(serie.id, { phaseId: e.target.value || null }))}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
            title="Agrupa esta serie bajo una fase. Es opcional y no se ve en el sitio."
          >
            <option value="">Sin fase</option>
            {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : null}
        <AvisoGuardado pending={pending} guardado={guardado} error={error} />
      </div>
      <Entregas serie={serie} />
    </div>
  );
}

// ─── Temas complementarios ──────────────────────────────────────────────────

function SeccionComplementos({ topics, complements }) {
  const { pending, error, run } = useAccion();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <Encabezado
        titulo="Temas que se acompañan"
        queEs="Pares de temas que conviene leer juntos. Sirven para sugerir la lectura siguiente a quien terminó un artículo."
        ejemplo="«Duelo» ↔ «Ansiedad»: quien lee sobre uno probablemente busque el otro."
        dondeSeVe="Recomendaciones al final de los artículos. El vínculo vale en los dos sentidos: basta cargarlo una vez."
      />

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); if (fromId && toId) run(() => linkComplementaryTopics(fromId, toId)); }}
      >
        <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="input">
          <option value="">Elegí un tema…</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="text-slate-400">se acompaña con</span>
        <select value={toId} onChange={(e) => setToId(e.target.value)} className="input">
          <option value="">Elegí otro…</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="submit" disabled={pending || !fromId || !toId || fromId === toId} className="btn btn-accent disabled:opacity-60">Vincular</button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {topics.length < 2 ? (
        <p className="mt-2 text-sm text-slate-500">Hacen falta al menos dos temas cargados para poder vincularlos.</p>
      ) : null}

      <ul className="mt-4 flex flex-wrap gap-2">
        {complements.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-nv border border-slate-300 bg-white px-3 py-1 text-sm">
            <span>{c.from.name} ↔ {c.to.name}</span>
            <button
              type="button"
              onClick={() => run(() => unlinkComplementaryTopics(c.from.id, c.to.id))}
              className="text-red-500 hover:text-red-700"
              aria-label={`Quitar el vínculo entre ${c.from.name} y ${c.to.name}`}
            >
              ✕
            </button>
          </li>
        ))}
        {complements.length === 0 ? <li className="py-1 text-sm text-slate-500">Sin vínculos todavía.</li> : null}
      </ul>
    </section>
  );
}

// ─── Fases: plegadas, porque casi nunca hacen falta ─────────────────────────

function SeccionFases({ phases }) {
  const [abierto, setAbierto] = useState(phases.length > 0);

  if (!abierto) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-4 lg:col-span-2">
        <button type="button" onClick={() => setAbierto(true)} className="text-left text-sm text-slate-600 hover:text-slate-900">
          <span className="font-bold">Fases</span> — agrupan series entre sí. No se ven en el sitio y
          no hacen falta salvo que las series lleguen a ser muchas.{" "}
          <span className="font-semibold text-brand-700 underline">Mostrar</span>
        </button>
      </section>
    );
  }

  return (
    <SeccionTerminos
      titulo="Fases"
      queEs="Agrupan series entre sí, un escalón por encima. Son opcionales: solo sirven para acortar el desplegable cuando hay muchas series."
      ejemplo="Una fase «Historia» que contenga varias series sobre el origen de la salud mental."
      dondeSeVe="En ninguna parte: no tienen página ni filtro público. Solo ordenan el panel."
      placeholder="Nueva fase"
      terminos={phases}
      calcularEstado={(p) => estadoDeFase({ isActive: p.isActive, series: p._count.series })}
      tienePaginaPublica={false}
      textoEliminar={(p) => `¿Eliminar la fase «${p.name}»?\n\nLas series que estaban en ella no se borran: quedan sin fase.`}
      onCreate={createPhase}
      onRename={updatePhase}
      onToggle={updatePhase}
      onDelete={deletePhase}
      vacio="No hay fases, y está bien: no hacen falta hasta que las series sean muchas."
    />
  );
}

export default function TaxonomyManager({ disciplines, topics, phases, series, complements }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SeccionSeries series={series} phases={phases} />

      <SeccionTerminos
        titulo="Temas"
        queEs="El asunto del que trata un artículo, más allá de la serie a la que pertenezca. Un artículo puede tener varios."
        ejemplo="«Duelo», «Ansiedad», «Migración»."
        dondeSeVe="Página de archivo propia en /blog/tema/… y filtro en la biblioteca. Si además se le escribe contenido en «Temas» del panel, el mismo nombre pasa a tener una página propia en la raíz del sitio."
        placeholder="Nuevo tema — por ejemplo: Duelo"
        terminos={topics}
        calcularEstado={estadoDeTema}
        urlDe={(t) => `/blog/tema/${t.slug}`}
        tienePaginaPublica
        textoEliminar={(t) => `¿Eliminar el tema «${t.name}»?\n\nLos artículos no se borran: pierden esta etiqueta. La dirección /blog/tema/${t.slug} deja de existir.`}
        notaExtra={(t) => (t.status === "PUBLISHED" ? (
          // El mismo registro sostiene dos páginas distintas. Renombrarlo o
          // borrarlo desde acá también se lleva la de la raíz, y eso no se ve
          // por ninguna parte si no se dice.
          <p className="mt-1 pl-2 text-xs text-slate-500">
            Este tema también tiene página propia publicada en{" "}
            <a href={`/${t.slug}`} target="_blank" rel="noopener noreferrer" className="font-mono underline decoration-slate-300 hover:text-brand-700">/{t.slug}</a>, que se edita en{" "}
            <Link href="/panel/admin/temas" className="font-semibold text-brand-700 underline">Temas</Link>. Es el mismo registro: renombrarlo acá también cambia esa dirección.
          </p>
        ) : null)}
        onCreate={createTopic}
        onRename={updateTopic}
        onToggle={updateTopic}
        onDelete={deleteTopic}
        vacio="Todavía no hay temas."
      />

      <SeccionTerminos
        titulo="Disciplinas"
        queEs="Desde qué campo del saber está escrito el artículo. Responde «quién habla acá», no «de qué habla»."
        ejemplo="«Psicoanálisis», «Filosofía», «Salud pública»."
        dondeSeVe="Filtro en la biblioteca y etiqueta al pie de cada artículo. No tiene página propia."
        placeholder="Nueva disciplina — por ejemplo: Psicoanálisis"
        terminos={disciplines}
        calcularEstado={estadoDeDisciplina}
        urlDe={(d) => `/blog?disciplina=${d.slug}`}
        tienePaginaPublica={false}
        textoEliminar={(d) => `¿Eliminar la disciplina «${d.name}»?\n\nLos artículos no se borran: pierden esta etiqueta.`}
        onCreate={createDiscipline}
        onRename={updateDiscipline}
        onToggle={updateDiscipline}
        onDelete={deleteDiscipline}
        vacio="Todavía no hay disciplinas."
      />

      <SeccionComplementos topics={topics} complements={complements} />
      <SeccionFases phases={phases} />
    </div>
  );
}
