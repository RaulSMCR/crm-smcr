"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateSpecJson } from "@/lib/carousel-spec";
import CarouselStatusBadge from "@/components/admin/CarouselStatusBadge";
import CarouselImageGallery from "@/components/admin/CarouselImageGallery";
import CarouselPublishToBlog from "@/components/admin/CarouselPublishToBlog";

export default function CarouselEditor({ carousel, canApprove = false }) {
  const router = useRouter();
  const [specText, setSpecText] = useState(() => JSON.stringify(carousel.spec, null, 2));
  const [busy, setBusy] = useState(null); // "save" | "generate" | "status"
  const [message, setMessage] = useState(null); // { kind, text }
  const [assets, setAssets] = useState(carousel.assets);
  const [lightbox, setLightbox] = useState(null); // índice de slide abierta, o null
  const specRef = useRef(null);
  const messageRef = useRef(null);

  function focusSpec() {
    setLightbox(null);
    setTimeout(() => {
      specRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      specRef.current?.focus();
    }, 60);
  }

  // Re-sincroniza con el servidor tras regenerar (router.refresh cambia la prop).
  useEffect(() => {
    setAssets(carousel.assets);
  }, [carousel.assets]);

  // Lleva a la vista el mensaje de estado (éxito/error) para que no pase desapercibido.
  useEffect(() => {
    if (message) messageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [message]);

  const validation = useMemo(() => validateSpecJson(specText), [specText]);
  const dirty = useMemo(
    () => specText !== JSON.stringify(carousel.spec, null, 2),
    [specText, carousel.spec]
  );
  const hasAssets = assets.length > 0;
  const readyCount = assets.filter((a) => a.ready).length;
  const allReady = hasAssets && readyCount === assets.length;

  function notify(kind, text) {
    setMessage({ kind, text });
  }

  function insertImage(index, specValue, style) {
    try {
      const spec = JSON.parse(specText);
      if (!spec?.slides?.[index]) return;
      spec.slides[index].image = specValue;
      spec.slides[index].image_style = style;
      setSpecText(JSON.stringify(spec, null, 2));
      notify("ok", `Imagen insertada en la slide ${index + 1} (${style}). Guarda la spec y regenera.`);
    } catch {
      notify("error", "La spec debe ser JSON válido para insertar la imagen.");
    }
  }

  async function patchAsset(assetId, patch) {
    try {
      const res = await fetch(`/api/admin/carousels/${carousel.id}/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, ...data } : a)));
        return true;
      }
      notify("error", data.message || "No se pudo guardar la revisión");
    } catch (err) {
      notify("error", String(err));
    }
    return false;
  }

  function updateNoteLocal(assetId, note) {
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, note } : a)));
  }

  async function saveSpec() {
    if (!validation.ok) return notify("error", "Corrige los errores de la spec antes de guardar.");
    setBusy("save");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/carousels/${carousel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: validation.data }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.errors) ? ` (${data.errors.join("; ")})` : "";
        notify("error", `${data.message || "No se pudo guardar"}${detail}`);
      } else {
        notify("ok", "Spec guardada. El carrusel volvió a Borrador.");
        router.refresh();
      }
    } catch (err) {
      notify("error", String(err));
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!validation.ok) return notify("error", "Corrige los errores de la spec antes de generar.");
    setBusy("generate");
    setMessage({ kind: "ok", text: "Generando slides… (puede tardar 5-15s)" });
    try {
      // La generación lee la spec de la DB: si hay cambios sin guardar, guarda primero.
      if (dirty) {
        const saveRes = await fetch(`/api/admin/carousels/${carousel.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spec: validation.data }),
        });
        if (!saveRes.ok) {
          const d = await saveRes.json().catch(() => ({}));
          notify("error", `No se pudo guardar la spec antes de generar: ${d.message || saveRes.status}`);
          setBusy(null);
          return;
        }
      }
      const res = await fetch(`/api/admin/carousels/${carousel.id}/generate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail ? ` — ${JSON.stringify(data.detail)}` : "";
        notify(
          "error",
          `${data.message || "Falló la generación"}${detail}. ` +
            "Recuerda: la generación necesita el entorno desplegado (función Python + buckets); en desarrollo local no corre."
        );
      } else {
        notify("ok", `Generadas ${data.count} slides.`);
        router.refresh();
      }
    } catch (err) {
      notify("error", String(err));
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(status) {
    setBusy("status");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/carousels/${carousel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) notify("error", data.message || "No se pudo cambiar el estado");
      else {
        notify("ok", `Estado: ${status}.`);
        router.refresh();
      }
    } catch (err) {
      notify("error", String(err));
    } finally {
      setBusy(null);
    }
  }

  const busyAny = busy !== null;

  // Slide del lightbox: si es cover/narrative, admite foto (duotono) por-slide.
  const lightboxSpecSlide = lightbox !== null && validation.ok ? validation.data.slides?.[lightbox] : null;
  const lightboxIsImage =
    !!lightboxSpecSlide && (lightboxSpecSlide.type === "cover" || lightboxSpecSlide.type === "narrative");

  return (
    <div className="space-y-6">
      {message ? (
        <p
          ref={messageRef}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            message.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-accent-300 bg-accent-50 text-accent-900"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Editor de spec */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-950">Spec</h2>
            <span className={`text-xs font-semibold ${validation.ok ? "text-emerald-600" : "text-accent-700"}`}>
              {validation.ok ? "Válida ✓" : `${validation.errors.length} error(es)`}
            </span>
          </div>
          <textarea
            ref={specRef}
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            spellCheck={false}
            rows={24}
            className="w-full rounded-lg border border-neutral-300 bg-neutral-950 px-3 py-2 font-mono text-xs leading-relaxed text-neutral-100 focus:border-brand-500 focus:outline-none"
          />
          {!validation.ok ? (
            <ul className="mt-2 space-y-1 rounded-lg border border-accent-200 bg-accent-50 p-3 text-xs text-accent-900">
              {validation.errors.map((msg, i) => (
                <li key={i} className="font-mono">• {msg}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={saveSpec}
              disabled={busyAny || !validation.ok || !dirty}
              title={!dirty ? "No hay cambios que guardar" : "Guardar la spec"}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "save" ? "Guardando…" : dirty ? "Guardar spec" : "Spec guardada ✓"}
            </button>
            <button
              onClick={generate}
              disabled={busyAny || !validation.ok}
              title={dirty ? "Guarda los cambios y genera (auto-guarda)" : "Generar slides (~5-15s)"}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "generate" ? "Generando…" : hasAssets ? "Regenerar slides" : "Generar slides"}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Aquí editas el contenido. <strong>Regenerar slides</strong> guarda los cambios y recrea los previews
            (~5-15s). Ojo: la generación requiere el entorno desplegado (función Python + buckets); en desarrollo
            local no corre.
          </p>
        </section>

        {/* Previews */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-950">Previews</h2>
            <span className="text-xs text-neutral-500">
              {assets.length} slides{hasAssets ? ` · ${readyCount} listas` : ""}
            </span>
          </div>
          {hasAssets ? (
            <p className="mb-2 text-xs text-neutral-500">Click en una slide para verla en grande, anotar y marcar “listo”.</p>
          ) : null}

          {hasAssets ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {assets.map((a, i) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setLightbox(i)}
                  className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white text-left"
                >
                  {a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.filename} className="block aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center text-xs text-neutral-400">sin URL</div>
                  )}
                  <span
                    className={`absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      a.ready ? "bg-emerald-600 text-white" : "bg-neutral-900/60 text-white"
                    }`}
                  >
                    {a.ready ? "✓ listo" : i + 1}
                  </span>
                  {a.note ? (
                    <span className="absolute left-1.5 top-1.5 rounded bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                      nota
                    </span>
                  ) : null}
                  <span className="block truncate px-2 py-1 text-[11px] text-neutral-500 group-hover:text-brand-700">
                    {a.filename}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
              Aún no hay slides generadas. Ajusta la spec y pulsa “Generar slides”.
            </p>
          )}

          {assets.some((a) => a.note) ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-bold">Notas de edición ({assets.filter((a) => a.note).length})</span>
                <button
                  onClick={focusSpec}
                  className="rounded border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-900 transition hover:bg-amber-100"
                >
                  Editar la spec →
                </button>
              </div>
              <ul className="space-y-1">
                {assets
                  .filter((a) => a.note)
                  .map((a) => (
                    <li key={a.id}>
                      <span className="font-semibold">Slide {a.index + 1}:</span> {a.note}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/api/admin/carousels/${carousel.id}/download`}
              className={`rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-brand-400 ${
                hasAssets ? "" : "pointer-events-none opacity-50"
              }`}
            >
              Descargar ZIP
            </a>
            {canApprove ? (
              <>
                <button
                  onClick={() => setStatus("APPROVED")}
                  disabled={busyAny || !hasAssets || !allReady || carousel.status === "APPROVED"}
                  title={
                    !allReady
                      ? `Marca todas las slides como listas primero (${readyCount}/${assets.length})`
                      : "Aprobar todas"
                  }
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {carousel.status === "APPROVED"
                    ? "Aprobado"
                    : `Aprobar todas (${readyCount}/${assets.length})`}
                </button>
                <button
                  onClick={() => setStatus("PUBLISHED")}
                  disabled={busyAny || !hasAssets || carousel.status === "PUBLISHED"}
                  className="rounded-lg border border-accent-300 bg-accent-100 px-4 py-2 text-sm font-semibold text-accent-950 transition hover:bg-accent-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Marcar publicado
                </button>
              </>
            ) : null}
          </div>
        </section>
      </div>

      {canApprove ? (
        <CarouselPublishToBlog
          carouselId={carousel.id}
          defaultTitle={carousel.title}
          hasSource={carousel.hasSource}
          sourcePostId={carousel.sourcePostId}
          blogPostId={carousel.blogPostId}
        />
      ) : null}

      {lightbox !== null && assets[lightbox] ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex max-h-full w-full max-w-5xl flex-col gap-4 overflow-auto lg:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-1 items-center justify-center">
              {assets[lightbox].url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={assets[lightbox].url}
                  alt={assets[lightbox].filename}
                  className="mx-auto max-h-[85vh] w-auto rounded-lg"
                />
              ) : (
                <div className="text-white">sin URL</div>
              )}
            </div>

            <div className="w-full shrink-0 rounded-lg bg-white p-4 lg:w-80">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-neutral-900">
                  Slide {lightbox + 1} / {assets.length}
                </span>
                <button onClick={() => setLightbox(null)} className="text-sm text-neutral-500 hover:text-neutral-800">
                  Cerrar ✕
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <input
                  type="checkbox"
                  checked={!!assets[lightbox].ready}
                  onChange={(e) => patchAsset(assets[lightbox].id, { ready: e.target.checked })}
                  className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                />
                Marcar como listo
              </label>

              <label className="mt-3 block">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Nota de edición</span>
                <textarea
                  value={assets[lightbox].note || ""}
                  onChange={(e) => updateNoteLocal(assets[lightbox].id, e.target.value)}
                  onBlur={(e) => patchAsset(assets[lightbox].id, { note: e.target.value })}
                  rows={5}
                  placeholder="Qué ajustar en esta slide…"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none"
                />
                <span className="mt-1 block text-[11px] text-neutral-400">Se guarda al salir del campo.</span>
              </label>

              {lightboxIsImage ? (
                <div className="mt-4 border-t border-neutral-200 pt-3">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                    Imagen de la slide (duotono)
                  </span>
                  <div className="mt-2">
                    <CarouselImageGallery
                      slides={[
                        {
                          index: lightbox,
                          type: lightboxSpecSlide.type,
                          title: lightboxSpecSlide.title || lightboxSpecSlide.hook || `Slide ${lightbox + 1}`,
                        },
                      ]}
                      onInsert={insertImage}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Tras insertar, cierra y pulsa Regenerar para ver la foto.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setLightbox((v) => (v > 0 ? v - 1 : v))}
                  disabled={lightbox === 0}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setLightbox((v) => (v < assets.length - 1 ? v + 1 : v))}
                  disabled={lightbox === assets.length - 1}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>

              <div className="mt-4 space-y-2 border-t border-neutral-200 pt-3">
                {lightbox === assets.length - 1 ? (
                  <p className="text-xs font-semibold text-emerald-700">
                    Última slide. Cuando termines de anotar, usa “Terminar revisión”.
                  </p>
                ) : null}
                <button
                  onClick={() => setLightbox(null)}
                  className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
                >
                  Terminar revisión
                </button>
                <button
                  onClick={focusSpec}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:border-brand-400"
                >
                  Editar la spec →
                </button>
                <p className="text-[11px] text-neutral-400">
                  Las notas son recordatorios. Los cambios se hacen editando la spec y regenerando.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
