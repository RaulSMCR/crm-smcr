"use client";

import { useEffect, useState } from "react";

export default function CarouselVersionHistory({ carouselId, activeVersionId = null }) {
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/carousels/${carouselId}/versions`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "No se pudo cargar el historial.");
        if (!cancelled) setVersions(data.versions || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || String(err));
      });
    return () => { cancelled = true; };
  }, [carouselId]);

  async function restore(versionId) {
    if (!window.confirm("¿Restaurar esta versión como una nueva versión activa?")) return;
    setBusy(versionId);
    setError("");
    try {
      const response = await fetch(`/api/admin/carousels/${carouselId}/versions/${versionId}/restore`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo restaurar la versión.");
      window.location.reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
      <h2 className="text-base font-bold text-brand-900">Historial de versiones</h2>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {!error && versions.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Todavía no hay versiones registradas.</p>
      ) : null}
      {versions.length ? (
        <ol className="mt-3 space-y-2">
          {versions.map((version) => (
            <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm">
              <div>
                <span className="font-semibold text-neutral-900">Versión {version.number}</span>
                {version.id === activeVersionId ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Activa</span> : null}
                <p className="text-xs text-neutral-500">{version.comment || version.source} · {new Date(version.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">{version.assetCount} assets · {version.approvalEventCount} revisiones</span>
                {version.id !== activeVersionId ? (
                  <button type="button" onClick={() => restore(version.id)} disabled={busy !== ""} className="rounded border border-brand-300 px-2 py-1 text-xs font-semibold text-brand-800 disabled:opacity-50">
                    {busy === version.id ? "Restaurando…" : "Restaurar"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
