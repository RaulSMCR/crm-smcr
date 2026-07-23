"use client";

import { useState } from "react";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function EditorialPackageActions({ carouselId, articleId = null }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [jsonFile, setJsonFile] = useState(null);
  const [assetFiles, setAssetFiles] = useState([]);
  const [preview, setPreview] = useState(null);

  async function exportPackage() {
    if (!articleId) {
      setMessage({ kind: "error", text: "Este carrusel no tiene artículo fuente seleccionado." });
      return;
    }
    setBusy("export");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/editorial/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, carouselId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo exportar el paquete.");
      }
      const blob = await response.blob();
      downloadBlob(blob, `${carouselId}-editorial-package.zip`);
      setMessage({ kind: "ok", text: "Paquete exportado." });
    } catch (error) {
      setMessage({ kind: "error", text: error.message || String(error) });
    } finally {
      setBusy("");
    }
  }

  function onJsonChange(event) {
    setJsonFile(event.target.files?.[0] || null);
    setPreview(null);
    setMessage(null);
  }

  function onAssetsChange(event) {
    setAssetFiles([...event.target.files]);
    setPreview(null);
    setMessage(null);
  }

  function buildForm() {
    const form = new FormData();
    form.append("carouselId", carouselId);
    form.append("carousel.json", jsonFile);
    for (const file of assetFiles) form.append("assets", file);
    return form;
  }

  async function previewImport() {
    if (!jsonFile) {
      setMessage({ kind: "error", text: "Selecciona carousel.json." });
      return;
    }
    setBusy("preview");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/editorial/import/preview", { method: "POST", body: buildForm() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo validar el paquete.");
      setPreview(data);
      setMessage({ kind: "ok", text: "Vista previa preparada. La base de datos no fue modificada." });
    } catch (error) {
      setMessage({ kind: "error", text: error.message || String(error) });
    } finally {
      setBusy("");
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy("confirm");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/editorial/import/confirm", { method: "POST", body: buildForm() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo confirmar la importación.");
      setMessage({ kind: "ok", text: `Importación confirmada. Nueva versión ${data.version?.number || "creada"}.` });
      setPreview(null);
      window.location.reload();
    } catch (error) {
      setMessage({ kind: "error", text: error.message || String(error) });
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-brand-100 bg-white p-4 shadow-card">
      <div>
        <h2 className="text-base font-bold text-brand-900">Paquete editorial manual</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Exporta el carrusel para trabajarlo fuera del CRM o importa una propuesta con vista previa.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportPackage}
          disabled={busy !== ""}
          className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "export" ? "Exportando…" : "Exportar paquete"}
        </button>
      </div>

      <div className="grid gap-3 border-t border-neutral-200 pt-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-neutral-800">
          carousel.json
          <input type="file" accept="application/json,.json" onChange={onJsonChange} className="mt-1 block w-full text-sm" />
        </label>
        <label className="block text-sm font-semibold text-neutral-800">
          Imágenes relacionadas
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onAssetsChange} className="mt-1 block w-full text-sm" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={previewImport}
          disabled={busy !== "" || !jsonFile}
          className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 disabled:opacity-50"
        >
          {busy === "preview" ? "Validando…" : "Ver diferencias"}
        </button>
        {preview ? (
          <button
            type="button"
            onClick={confirmImport}
            disabled={busy !== ""}
            className="rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "confirm" ? "Guardando…" : "Confirmar nueva versión"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={`rounded-lg border px-3 py-2 text-sm font-semibold ${message.kind === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      ) : null}

      {preview ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className="font-semibold text-neutral-900">
            {preview.imported?.slideCount || 0} slides propuestas · {preview.diff?.length || 0} cambios
          </p>
          {preview.diff?.length ? (
            <ul className="mt-2 space-y-1 text-neutral-700">
              {preview.diff.map((change) => (
                <li key={change.slideId}>
                  <span className="font-mono text-xs">{change.slideId}</span>: {change.kind}
                  {change.textChanged ? " · texto" : ""}
                  {change.assetChanged ? " · asset" : ""}
                  {change.orderChanged ? " · orden" : ""}
                  {change.approvalChanged ? " · aprobación" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-neutral-600">No se detectaron diferencias.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
