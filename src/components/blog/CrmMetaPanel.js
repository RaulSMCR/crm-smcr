"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { savePostCrmMeta } from "@/actions/taxonomy-actions";

const SUGGESTED_LABELS = {
  "": "— Sin sugerir —",
  DRAFT: "Borrador",
  READY: "Listo para publicar",
  ARCHIVE: "Archivar",
};

function normalizeTerm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[«».,:;]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function CrmMetaPanel({
  postId,
  mode = "suggest", // "suggest" (profesional) | "approve" (admin)
  vocab = { phases: [], series: [] },
  initial = {},
  includeSeo = true,
}) {
  const seriesById = useMemo(() => {
    const m = {};
    for (const s of vocab.series) m[s.id] = s;
    return m;
  }, [vocab.series]);

  const [metaTitle, setMetaTitle] = useState(initial.metaTitle || "");
  const [metaDescription, setMetaDescription] = useState(initial.metaDescription || "");
  const [focusKeyword, setFocusKeyword] = useState(initial.focusKeyword || "");
  const [seriesId, setSeriesId] = useState(initial.seriesId || "");
  const [phaseId, setPhaseId] = useState(() => (initial.seriesId && seriesById[initial.seriesId]?.phaseId) || "");
  const [seriesOrder, setSeriesOrder] = useState(initial.seriesOrder || "");
  const [suggestedStatus, setSuggestedStatus] = useState(initial.suggestedStatus || "");
  const [importedLinks, setImportedLinks] = useState([]);
  const [importedParts, setImportedParts] = useState("");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onEditorialMetadata(event) {
      const imported = event.detail || {};
      if (Array.isArray(imported.internalLinks)) setImportedLinks(imported.internalLinks);
      if (imported.parts) setImportedParts(imported.parts);
      if (includeSeo) {
        if (imported.metaTitle) setMetaTitle(imported.metaTitle);
        if (imported.metaDescription) setMetaDescription(imported.metaDescription);
        if (imported.focusKeyword) setFocusKeyword(imported.focusKeyword);
      }

      const importedPhase = normalizeTerm(imported.phase);
      const importedSeries = normalizeTerm(imported.series);
      const phase = importedPhase
        ? vocab.phases.find((item) => {
            const name = normalizeTerm(item.name);
            const slug = normalizeTerm(item.slug);
            return name === importedPhase || slug === importedPhase || importedPhase.startsWith(`${name} `);
          })
        : null;
      const series = importedSeries
        ? vocab.series.find((item) => {
            const name = normalizeTerm(item.name);
            const slug = normalizeTerm(item.slug);
            return name === importedSeries || slug === importedSeries;
          })
        : null;

      if (phase) setPhaseId(phase.id);
      if (series) {
        setSeriesId(series.id);
        setPhaseId(series.phaseId || phase?.id || "");
      }
      if (Number.isInteger(imported.partNumber) && imported.partNumber > 0) {
        setSeriesOrder(String(imported.partNumber));
      }

      const importedFields = [
        includeSeo && imported.metaTitle,
        includeSeo && imported.metaDescription,
        includeSeo && imported.focusKeyword,
        phase,
        series,
        imported.partNumber,
        imported.internalLinks?.length,
        imported.parts,
      ].filter(Boolean).length;
      if (importedFields) {
        setNotice("Metadatos CRM detectados. Revisá y guardá los cambios.");
      }
    }

    window.addEventListener("crm:editorial-metadata", onEditorialMetadata);
    return () => window.removeEventListener("crm:editorial-metadata", onEditorialMetadata);
  }, [includeSeo, vocab.phases, vocab.series]);

  // La fase filtra las series disponibles (Fase > Serie > Parte).
  const seriesOptions = useMemo(
    () => (phaseId ? vocab.series.filter((s) => s.phaseId === phaseId) : vocab.series),
    [phaseId, vocab.series]
  );

  function onPhaseChange(value) {
    setPhaseId(value);
    // Si la serie elegida no pertenece a la nueva fase, se limpia.
    if (value && seriesId && seriesById[seriesId]?.phaseId !== value) {
      setSeriesId("");
      setSeriesOrder("");
    }
  }

  function save() {
    setNotice(null);
    setError(null);
    const payload = {
      seriesId: seriesId || null,
      seriesOrder: seriesId && seriesOrder ? Number(seriesOrder) : null,
      suggestedStatus: suggestedStatus || null,
    };
    if (includeSeo) {
      payload.metaTitle = metaTitle;
      payload.metaDescription = metaDescription;
      payload.focusKeyword = focusKeyword;
    }
    startTransition(async () => {
      const res = await savePostCrmMeta(postId, payload, { mode });
      if (res?.error) setError(res.error);
      else setNotice("Metadatos guardados.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Metadatos CRM</h3>
        {mode === "suggest" ? (
          <span className="text-xs text-slate-500">La serie queda pendiente de aprobación</span>
        ) : null}
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{notice}</div> : null}

      {includeSeo ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Meta title</span>
            <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="input w-full" placeholder="Título para buscadores (50–60 caracteres)" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Meta description</span>
            <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className="input w-full" placeholder="Resumen para buscadores (120–160 caracteres)" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Focus keyword</span>
            <input value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} className="input w-full" placeholder="Ej. psicólogo en Costa Rica" />
          </label>
        </div>
      ) : null}

      {/* Fase → Serie → Parte */}
      {importedLinks.length || importedParts ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-slate-700">
          <div className="font-semibold text-slate-800">Orientación editorial detectada</div>
          {importedParts ? <p className="mt-1">Partes: {importedParts}</p> : null}
          {importedLinks.length ? (
            <>
              <p className="mt-2 font-semibold">Enlaces internos sugeridos:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {importedLinks.map((link, index) => <li key={`${link}-${index}`}>{link}</li>)}
              </ul>
            </>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">Usá estas sugerencias para revisar el artículo; no modifican enlaces automáticamente.</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Fase</span>
          <select value={phaseId} onChange={(e) => onPhaseChange(e.target.value)} className="input w-full">
            <option value="">— Todas —</option>
            {vocab.phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Serie</span>
          <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="input w-full">
            <option value="">— Sin serie —</option>
            {seriesOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Parte</span>
          <input type="number" min="1" value={seriesOrder} onChange={(e) => setSeriesOrder(e.target.value)} disabled={!seriesId} placeholder="—" className="input w-full disabled:opacity-50" />
        </label>
      </div>

      {/* Estado sugerido */}
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Estado sugerido</span>
        <select value={suggestedStatus} onChange={(e) => setSuggestedStatus(e.target.value)} className="input w-full sm:max-w-xs">
          {Object.entries(SUGGESTED_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <button type="button" onClick={save} disabled={pending} className="btn btn-accent disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar metadatos"}
      </button>
    </div>
  );
}
