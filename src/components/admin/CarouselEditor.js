"use client";

import { useMemo, useState } from "react";
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

  const validation = useMemo(() => validateSpecJson(specText), [specText]);
  const dirty = useMemo(
    () => specText !== JSON.stringify(carousel.spec, null, 2),
    [specText, carousel.spec]
  );
  const hasAssets = carousel.assets.length > 0;

  function notify(kind, text) {
    setMessage({ kind, text });
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
    if (dirty) return notify("error", "Guarda los cambios de la spec antes de generar.");
    setBusy("generate");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/carousels/${carousel.id}/generate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail ? ` — ${JSON.stringify(data.detail)}` : "";
        notify("error", `${data.message || "Falló la generación"}${detail}`);
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

  return (
    <div className="space-y-6">
      {message ? (
        <p
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
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "save" ? "Guardando…" : "Guardar spec"}
            </button>
            <button
              onClick={generate}
              disabled={busyAny || !validation.ok || dirty}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
              title={dirty ? "Guarda la spec antes de generar" : "Generar slides (~10-30s)"}
            >
              {busy === "generate" ? "Generando…" : hasAssets ? "Regenerar slides" : "Generar slides"}
            </button>
          </div>
        </section>

        {/* Previews */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-950">Previews</h2>
            <span className="text-xs text-neutral-500">{carousel.assets.length} slides</span>
          </div>

          {hasAssets ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {carousel.assets.map((a) => (
                <figure key={a.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                  {a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.filename} width={a.width} height={a.height} className="block aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center text-xs text-neutral-400">
                      sin URL
                    </div>
                  )}
                  <figcaption className="truncate px-2 py-1 text-[11px] text-neutral-500">{a.filename}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
              Aún no hay slides generadas. Ajusta la spec y pulsa “Generar slides”.
            </p>
          )}

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
                  disabled={busyAny || !hasAssets || carousel.status === "APPROVED"}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Aprobar
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

      <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
        <summary className="cursor-pointer text-lg font-bold text-neutral-950">
          Galería de imágenes
        </summary>
        <div className="mt-4">
          <CarouselImageGallery />
        </div>
      </details>
    </div>
  );
}
