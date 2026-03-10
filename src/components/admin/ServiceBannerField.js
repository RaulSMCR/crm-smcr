"use client";

import { useId, useRef, useState } from "react";

const FALLBACK_BANNER =
  "https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80&auto=format&fit=crop";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function BannerPreview({
  title,
  subtitle,
  imageUrl,
  focusX,
  focusY,
  scale,
  onPickPosition,
  heightClass,
  overlayClass = "",
}) {
  const containerRef = useRef(null);
  const draggingRef = useRef(false);

  function updateFromPointer(clientX, clientY) {
    if (!containerRef.current || !onPickPosition) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nextX = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const nextY = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    onPickPosition(Math.round(nextX), Math.round(nextY));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>

      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${heightClass} ${
          onPickPosition ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onMouseDown={(event) => {
          draggingRef.current = true;
          updateFromPointer(event.clientX, event.clientY);
        }}
        onMouseMove={(event) => {
          if (!draggingRef.current) return;
          updateFromPointer(event.clientX, event.clientY);
        }}
        onMouseUp={() => {
          draggingRef.current = false;
        }}
        onMouseLeave={() => {
          draggingRef.current = false;
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          updateFromPointer(touch.clientX, touch.clientY);
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          updateFromPointer(touch.clientX, touch.clientY);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Vista previa del banner del servicio"
          className="h-full w-full object-cover select-none"
          draggable="false"
          style={{
            objectPosition: `${focusX}% ${focusY}%`,
            transform: `scale(${scale / 100})`,
            transformOrigin: "center",
          }}
        />

        <div className={`pointer-events-none absolute inset-0 ${overlayClass}`} />

        <div className="pointer-events-none absolute inset-0 border border-white/20" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
        <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/30" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/20" />
      </div>
    </div>
  );
}

export default function ServiceBannerField({
  serviceId = null,
  initialUrl = "",
  initialFocusX = 50,
  initialFocusY = 50,
  initialScale = 100,
}) {
  const inputId = useId();
  const [bannerUrl, setBannerUrl] = useState(initialUrl || "");
  const [focusX, setFocusX] = useState(initialFocusX ?? 50);
  const [focusY, setFocusY] = useState(initialFocusY ?? 50);
  const [scale, setScale] = useState(initialScale ?? 100);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [tempKey] = useState(() => {
    if (serviceId) return `service-${serviceId}`;
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `service-new-${crypto.randomUUID()}`;
    }
    return `service-new-${Date.now()}`;
  });

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("serviceKey", tempKey);

      const response = await fetch("/api/upload/service-banner", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "No fue posible subir la imagen.");
      }

      setBannerUrl(result.url || "");
      event.target.value = "";
    } catch (uploadError) {
      setError(uploadError.message || "No fue posible subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  const imageUrl = bannerUrl || FALLBACK_BANNER;

  return (
    <div className="space-y-4">
      <input type="hidden" name="bannerImage" value={bannerUrl} />
      <input type="hidden" name="bannerFocusX" value={focusX} />
      <input type="hidden" name="bannerFocusY" value={focusY} />
      <input type="hidden" name="bannerScale" value={scale} />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">Editor de encuadre</div>
            <p className="text-sm text-slate-500">
              Arrastra sobre la vista previa para mover la obra. Usa zoom para darle mas protagonismo.
            </p>
          </div>
          <div className="text-xs text-slate-500">Recomendado: 1600x900, JPG/WebP, 300 KB a 1.5 MB.</div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <BannerPreview
              title="Vista desktop"
              subtitle="16:9 principal"
              imageUrl={imageUrl}
              focusX={focusX}
              focusY={focusY}
              scale={scale}
              onPickPosition={(nextX, nextY) => {
                setFocusX(nextX);
                setFocusY(nextY);
              }}
              heightClass="aspect-[16/9] w-full"
              overlayClass="bg-gradient-to-t from-slate-950/45 via-transparent to-transparent"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <BannerPreview
                title="Vista mobile"
                subtitle="Recorte estrecho"
                imageUrl={imageUrl}
                focusX={focusX}
                focusY={focusY}
                scale={scale}
                onPickPosition={(nextX, nextY) => {
                  setFocusX(nextX);
                  setFocusY(nextY);
                }}
                heightClass="mx-auto aspect-[4/5] max-w-[260px] w-full"
                overlayClass="bg-gradient-to-t from-slate-950/35 via-transparent to-transparent"
              />

              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Zoom de la imagen</span>
                  <input
                    type="range"
                    min="100"
                    max="160"
                    value={scale}
                    onChange={(event) => setScale(Number(event.target.value))}
                    className="w-full"
                  />
                  <span className="mt-1 block text-xs text-slate-500">Escala: {scale}%</span>
                </label>

                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Posicion horizontal fina</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={focusX}
                    onChange={(event) => setFocusX(Number(event.target.value))}
                    className="w-full"
                  />
                  <span className="mt-1 block text-xs text-slate-500">X: {focusX}%</span>
                </label>

                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Posicion vertical fina</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={focusY}
                    onChange={(event) => setFocusY(Number(event.target.value))}
                    className="w-full"
                  />
                  <span className="mt-1 block text-xs text-slate-500">Y: {focusY}%</span>
                </label>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFocusX(50);
                      setFocusY(50);
                      setScale(100);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Recentrar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-medium text-slate-900">Archivo</div>

            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {uploading ? "Subiendo..." : bannerUrl ? "Cambiar banner" : "Subir banner"}
            </label>

            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />

            {bannerUrl ? (
              <button
                type="button"
                onClick={() => {
                  setBannerUrl("");
                  setError("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Quitar imagen
              </button>
            ) : null}

            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
              Usa una imagen horizontal con la obra bien iluminada.
              Si la pieza tiene detalle fino, sube una version de 1600x900 o superior.
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
