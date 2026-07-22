"use client";

import { useEffect, useState } from "react";

export default function CarouselImageGallery({ slides = [], onInsert = null }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [duotone, setDuotone] = useState(true);
  const [msg, setMsg] = useState(null); // { kind, text }
  const [copied, setCopied] = useState("");
  const [targetSlide, setTargetSlide] = useState("");

  const canInsert = Boolean(onInsert) && slides.length > 0;
  const effectiveTarget = targetSlide !== "" ? Number(targetSlide) : slides[0]?.index;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/carousels/images");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setImages(data.images || []);
      else setMsg({ kind: "error", text: data.message || "No se pudo cargar la galería" });
    } catch (err) {
      setMsg({ kind: "error", text: String(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/carousels/images", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "error", text: data.message || "No se pudo subir la imagen" });
      } else {
        setImages((prev) => [data, ...prev]);
        setMsg({ kind: "ok", text: `Imagen subida (${data.width}×${data.height}).` });
      }
    } catch (err) {
      setMsg({ kind: "error", text: String(err) });
    } finally {
      setUploading(false);
    }
  }

  const style = () => (duotone ? "duotone" : "photo");

  function snippetFor(specValue) {
    return `"image": "${specValue}", "image_style": "${style()}"`;
  }

  async function copySnippet(specValue) {
    try {
      await navigator.clipboard.writeText(snippetFor(specValue));
      setCopied(specValue);
      setTimeout(() => setCopied((c) => (c === specValue ? "" : c)), 1500);
    } catch {
      setMsg({ kind: "error", text: "No se pudo copiar al portapapeles." });
    }
  }

  function insert(specValue) {
    if (!canInsert || effectiveTarget === undefined) return;
    onInsert(effectiveTarget, specValue, style());
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-600">
        Sube o elige una foto y <strong>insértala</strong> en una slide <strong>cover</strong> o{" "}
        <strong>narrative</strong>. <span className="font-semibold text-brand-800">Duotono recomendado</span> —
        mantiene la paleta de marca. Mínimo 1080px de ancho.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800">
          {uploading ? "Subiendo…" : "Añadir imagen"}
          <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={duotone} onChange={(e) => setDuotone(e.target.checked)} />
          Duotono
        </label>
        {canInsert ? (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            Insertar en:
            <select
              value={targetSlide === "" ? String(effectiveTarget ?? "") : targetSlide}
              onChange={(e) => setTargetSlide(e.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-800 focus:border-brand-500 focus:outline-none"
            >
              {slides.map((s) => (
                <option key={s.index} value={s.index}>
                  {s.index + 1}. {s.type} — {String(s.title).slice(0, 30)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-xs text-neutral-500">
            {onInsert ? "Añade una slide cover o narrative para poder insertar." : ""}
          </span>
        )}
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-brand-400"
        >
          Recargar
        </button>
      </div>

      {msg ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            msg.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-accent-300 bg-accent-50 text-accent-900"
          }`}
        >
          {msg.text}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando galería…</p>
      ) : images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-center text-sm text-neutral-500">
          Sin imágenes aún. Sube la primera con “Añadir imagen”.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <figure key={img.storagePath} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt={img.storagePath} className="block aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center text-xs text-neutral-400">sin URL</div>
              )}
              <div className="flex divide-x divide-neutral-200 border-t border-neutral-200">
                {canInsert ? (
                  <button
                    type="button"
                    onClick={() => insert(img.specValue)}
                    className="flex-1 px-2 py-1.5 text-[11px] font-semibold text-white bg-brand-700 transition hover:bg-brand-800"
                  >
                    Insertar
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => copySnippet(img.specValue)}
                  className="flex-1 px-2 py-1.5 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-50"
                  title={snippetFor(img.specValue)}
                >
                  {copied === img.specValue ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
