"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [sinReconocer, setSinReconocer] = useState([]);

  // Disciplinas y temas que venían en el documento importado.
  //
  // Se marcan las que existen en el vocabulario y se listan aparte las que no,
  // en vez de crearlas: el vocabulario es curado, y un término nuevo inventado
  // por quien escribió el archivo se convertiría en una etiqueta de biblioteca
  // sin que nadie lo haya decidido. Marcar no publica nada —quedan SUGGESTED
  // hasta que el admin apruebe— pero ahorra volver a tipearlas.
  useEffect(() => {
    function onEditorialMetadata(event) {
      const imported = event.detail || {};
      const buscar = (vocabulario, nombres) => {
        const encontrados = [];
        const faltantes = [];
        for (const nombre of nombres || []) {
          const objetivo = norm(nombre);
          if (!objetivo) continue;
          const match = vocabulario.find(
            (item) => norm(item.name) === objetivo || norm(item.slug) === objetivo,
          );
          if (match) encontrados.push(match.id);
          else faltantes.push(String(nombre).trim());
        }
        return { encontrados, faltantes };
      };

      const d = buscar(vocab.disciplines, imported.disciplines);
      const t = buscar(vocab.topics, imported.topics);

      if (d.encontrados.length) setDisc((prev) => new Set([...prev, ...d.encontrados]));
      if (t.encontrados.length) setTopics((prev) => new Set([...prev, ...t.encontrados]));

      const noReconocidos = [...d.faltantes, ...t.faltantes];
      setSinReconocer(noReconocidos);

      if (d.encontrados.length || t.encontrados.length) {
        setNotice("Clasificación detectada en el documento. Revisá y guardá.");
      }
    }

    window.addEventListener("crm:editorial-metadata", onEditorialMetadata);
    return () => window.removeEventListener("crm:editorial-metadata", onEditorialMetadata);
  }, [vocab.disciplines, vocab.topics]);

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
      {sinReconocer.length ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          El documento pedía <b>{sinReconocer.join(", ")}</b>, que no están en el vocabulario.
          Elegí lo más cercano de acá, o agregalos primero desde Taxonomía si de verdad hacen
          falta.
        </div>
      ) : null}

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
