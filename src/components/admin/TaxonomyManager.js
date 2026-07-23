"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDiscipline, updateDiscipline, deleteDiscipline,
  createTopic, updateTopic, deleteTopic,
  createSeries, updateSeries, deleteSeries,
  linkComplementaryTopics, unlinkComplementaryTopics,
} from "@/actions/taxonomy-actions";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const run = (fn) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  };
  return { pending, error, run };
}

// Sección genérica para disciplinas y temas (mismo shape).
function TermSection({ title, terms, onCreate, onRename, onToggle, onDelete }) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState("");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) { run(() => onCreate(name.trim())); setName(""); } }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nueva ${title.toLowerCase().replace(/s$/, "")}`}
          className="input flex-1"
        />
        <button type="submit" disabled={pending} className="btn btn-accent disabled:opacity-60">Agregar</button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <ul className="mt-4 divide-y divide-slate-100">
        {terms.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
            <input
              defaultValue={t.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) run(() => onRename(t.id, { name: v })); }}
              className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-brand-400 focus:outline-none"
            />
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{t._count.posts} art.</span>
            <button
              type="button"
              onClick={() => run(() => onToggle(t.id, { isActive: !t.isActive }))}
              className={`rounded-nv border px-2 py-1 text-xs ${t.isActive ? "border-emerald-300 text-emerald-700" : "border-slate-300 text-slate-400"}`}
              title={t.isActive ? "Activa (visible en filtros)" : "Oculta"}
            >
              {t.isActive ? "Activa" : "Oculta"}
            </button>
            <button
              type="button"
              onClick={() => { if (confirm(`¿Eliminar «${t.name}»? Los artículos no se borran, solo pierden esta etiqueta.`)) run(() => onDelete(t.id)); }}
              className="rounded-nv border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          </li>
        ))}
        {terms.length === 0 ? <li className="py-3 text-sm text-slate-400">Todavía no hay.</li> : null}
      </ul>
    </section>
  );
}

function SeriesSection({ series }) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-900">Series</h2>
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) { run(() => createSeries(name.trim(), description.trim())); setName(""); setDescription(""); } }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la serie" className="input w-full" />
        <div className="flex gap-2">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)" className="input flex-1" />
          <button type="submit" disabled={pending} className="btn btn-accent disabled:opacity-60">Agregar</button>
        </div>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <ul className="mt-4 divide-y divide-slate-100">
        {series.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
            <input
              defaultValue={s.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) run(() => updateSeries(s.id, { name: v })); }}
              className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-brand-400 focus:outline-none"
            />
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{s._count.posts} art.</span>
            <button
              type="button"
              onClick={() => { if (confirm(`¿Eliminar la serie «${s.name}»? Los artículos no se borran, solo se desvinculan.`)) run(() => deleteSeries(s.id)); }}
              className="rounded-nv border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          </li>
        ))}
        {series.length === 0 ? <li className="py-3 text-sm text-slate-400">Todavía no hay.</li> : null}
      </ul>
    </section>
  );
}

function ComplementSection({ topics, complements }) {
  const { pending, error, run } = useAction();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-900">Temas complementarios</h2>
      <p className="mt-1 text-sm text-slate-500">Definí qué temas se complementan (ej: «ansiedad» ↔ «sueño»). La relación vale en ambos sentidos.</p>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); if (fromId && toId) run(() => linkComplementaryTopics(fromId, toId)); }}
      >
        <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="input">
          <option value="">Tema…</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="text-slate-400">↔</span>
        <select value={toId} onChange={(e) => setToId(e.target.value)} className="input">
          <option value="">Tema…</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="submit" disabled={pending || !fromId || !toId} className="btn btn-accent disabled:opacity-60">Vincular</button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <ul className="mt-4 flex flex-wrap gap-2">
        {complements.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-nv border border-slate-300 bg-white px-3 py-1 text-sm">
            <span>{c.from.name} ↔ {c.to.name}</span>
            <button
              type="button"
              onClick={() => run(() => unlinkComplementaryTopics(c.from.id, c.to.id))}
              className="text-red-500 hover:text-red-700"
              aria-label="Quitar vínculo"
            >
              ✕
            </button>
          </li>
        ))}
        {complements.length === 0 ? <li className="py-1 text-sm text-slate-400">Sin vínculos todavía.</li> : null}
      </ul>
    </section>
  );
}

export default function TaxonomyManager({ disciplines, topics, series, complements }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TermSection title="Disciplinas" terms={disciplines} onCreate={createDiscipline} onRename={updateDiscipline} onToggle={updateDiscipline} onDelete={deleteDiscipline} />
      <TermSection title="Temas" terms={topics} onCreate={createTopic} onRename={updateTopic} onToggle={updateTopic} onDelete={deleteTopic} />
      <SeriesSection series={series} />
      <ComplementSection topics={topics} complements={complements} />
    </div>
  );
}
