"use client";

import { useMemo, useState, useTransition } from "react";
import { suggestPostTaxonomy, approvePostTaxonomy } from "@/actions/taxonomy-actions";

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function Chip({ label, active, status, onClick }) {
  // Fondo inactivo por estilo inline: una regla global de marca repinta a teal
  // cualquier <button> con clase `bg-white` (ver LibraryBar).
  const base = "rounded-nv border px-3 py-1.5 text-sm transition select-none";
  const cls = active
    ? "border-brand-600 bg-brand-600 text-white"
    : "border-slate-300 text-slate-700 hover:border-brand-400";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${cls}`}
      style={active ? undefined : { backgroundColor: "#fff" }}
    >
      {label}
      {active && status === "SUGGESTED" ? <span className="ml-1 opacity-80" title="Sugerida, falta aprobar">·</span> : null}
    </button>
  );
}

export default function TaxonomyPicker({
  postId,
  mode = "suggest", // "suggest" (profesional) | "approve" (admin)
  vocab = { disciplines: [], topics: [], series: [] },
  initial = { disciplines: [], topics: [], seriesId: null, seriesOrder: null, seriesApproved: false },
  specialtyHint = "",
}) {
  const statusById = useMemo(() => {
    const m = {};
    for (const d of initial.disciplines || []) m["d:" + d.id] = d.status;
    for (const t of initial.topics || []) m["t:" + t.id] = t.status;
    return m;
  }, [initial]);

  const [disc, setDisc] = useState(() => new Set((initial.disciplines || []).map((d) => d.id)));
  const [topics, setTopics] = useState(() => new Set((initial.topics || []).map((t) => t.id)));
  const [seriesId, setSeriesId] = useState(initial.seriesId || "");
  const [seriesOrder, setSeriesOrder] = useState(initial.seriesOrder || "");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  // La "pista": disciplina del vocabulario que coincide con la especialidad del
  // autor. Un clic la agrega. Solo en modo sugerencia y si aún no está.
  const hintDiscipline = useMemo(() => {
    if (mode !== "suggest" || !specialtyHint) return null;
    const s = norm(specialtyHint);
    if (!s) return null;
    return (
      vocab.disciplines.find((d) => {
        const n = norm(d.name);
        return n === s || s.includes(n) || n.includes(s);
      }) || null
    );
  }, [mode, specialtyHint, vocab.disciplines]);

  const toggle = (setter) => (id) =>
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  function save() {
    setNotice(null);
    setError(null);
    const payload = {
      disciplineIds: [...disc],
      topicIds: [...topics],
      seriesId: seriesId || null,
      seriesOrder: seriesId && seriesOrder ? Number(seriesOrder) : null,
    };
    const action = mode === "approve" ? approvePostTaxonomy : suggestPostTaxonomy;
    startTransition(async () => {
      const res = await action(postId, payload);
      if (res?.error) setError(res.error);
      else setNotice(mode === "approve" ? "Clasificación aprobada." : "Clasificación enviada para revisión.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Clasificación de biblioteca</h3>
        {mode === "suggest" ? (
          <span className="text-xs text-slate-500">Tus etiquetas quedan pendientes de aprobación</span>
        ) : (
          <span className="text-xs text-slate-500">· = sugerida por el profesional</span>
        )}
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{notice}</div> : null}

      {/* Disciplinas */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Disciplinas</span>
          {hintDiscipline && !disc.has(hintDiscipline.id) ? (
            <button
              type="button"
              onClick={() => toggle(setDisc)(hintDiscipline.id)}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              + Sugerir «{hintDiscipline.name}» (tu especialidad)
            </button>
          ) : null}
        </div>
        {vocab.disciplines.length ? (
          <div className="flex flex-wrap gap-2">
            {vocab.disciplines.map((d) => (
              <Chip
                key={d.id}
                label={d.name}
                active={disc.has(d.id)}
                status={statusById["d:" + d.id]}
                onClick={() => toggle(setDisc)(d.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No hay disciplinas cargadas todavía.</p>
        )}
      </div>

      {/* Temas */}
      <div>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">Temas</span>
        {vocab.topics.length ? (
          <div className="flex flex-wrap gap-2">
            {vocab.topics.map((t) => (
              <Chip
                key={t.id}
                label={t.name}
                active={topics.has(t.id)}
                status={statusById["t:" + t.id]}
                onClick={() => toggle(setTopics)(t.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No hay temas cargados todavía.</p>
        )}
      </div>

      {/* Serie */}
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Serie</span>
          <select
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value)}
            className="input w-full"
          >
            <option value="">— Sin serie —</option>
            {vocab.series.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Posición</span>
          <input
            type="number"
            min="1"
            value={seriesOrder}
            onChange={(e) => setSeriesOrder(e.target.value)}
            disabled={!seriesId}
            placeholder="—"
            className="input w-full disabled:opacity-50"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="btn btn-accent disabled:opacity-60"
      >
        {pending ? "Guardando…" : mode === "approve" ? "Aprobar clasificación" : "Enviar clasificación"}
      </button>
    </div>
  );
}
