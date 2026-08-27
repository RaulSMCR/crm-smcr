"use client";

import { useId, useRef, useState } from "react";
import SafeImage from "@/components/SafeImage";
import { IMAGE_FALLBACKS, PUBLIC_IMAGE_ACCEPT, SUPPORTED_PUBLIC_IMAGE_TYPES } from "@/lib/images";

const FALLBACK_BANNER = IMAGE_FALLBACKS.service;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FORMAT_ERROR = "Formato no soportado. Usa JPG, PNG, WEBP, GIF o AVIF.";

// El banner se muestra a unos 880 px de ancho, que en pantallas retina son 1760
// px reales. Una imagen más chica se amplía y se ve borrosa: había banners
// publicados de 260 px de ancho, ampliados casi siete veces. El mínimo se valida
// en vez de solo sugerirse, porque sugerido no alcanzó.
const ANCHO_MINIMO = 1760;
const ALTO_MINIMO = 800;
const PROPORCION_MINIMA = 1.2; // por debajo de esto la imagen es casi cuadrada o vertical

/** Ancho y alto reales del archivo, antes de subirlo. */
function leerDimensiones(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // No se pudo medir (formato que el navegador no decodifica). Se deja pasar:
      // bloquear por no poder medir sería peor que subir una imagen sin verificar.
      resolve(null);
    };
    img.src = url;
  });
}

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
        <SafeImage
          src={imageUrl}
          alt="Vista previa del banner del servicio"
          fallbackSrc={FALLBACK_BANNER}
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
  const [aviso, setAviso] = useState("");
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
    setAviso("");
    if (file.type && !SUPPORTED_PUBLIC_IMAGE_TYPES.includes(file.type)) {
      setError(IMAGE_FORMAT_ERROR);
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen no puede pesar mas de 5 MB.");
      event.target.value = "";
      return;
    }

    const dim = await leerDimensiones(file);
    if (dim && (dim.width < ANCHO_MINIMO || dim.height < ALTO_MINIMO)) {
      setError(
        `Esta imagen mide ${dim.width}×${dim.height} px y se vería borrosa: el banner ` +
          `necesita al menos ${ANCHO_MINIMO}×${ALTO_MINIMO} px. Buscá una versión más grande del original.`,
      );
      event.target.value = "";
      return;
    }

    setAviso(
      dim && dim.width / dim.height < PROPORCION_MINIMA
        ? `La imagen es de ${dim.width}×${dim.height} px, más alta que ancha. Se va a recortar ` +
            `bastante para entrar en el banner: revisá el encuadre después de subirla.`
        : "",
    );

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
              accept={PUBLIC_IMAGE_ACCEPT}
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

            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <div className="font-semibold text-slate-800">Qué imagen subir</div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="font-medium text-slate-700">Tamaño mínimo</dt>
                <dd>
                  {ANCHO_MINIMO}×{ALTO_MINIMO} px. Por debajo de eso no se acepta: el banner se
                  muestra a 880 px y en pantallas retina necesita el doble.
                </dd>

                <dt className="font-medium text-slate-700">Orientación</dt>
                <dd>Horizontal. Una imagen vertical se recorta mucho al entrar en el banner.</dd>

                <dt className="font-medium text-slate-700">Formato</dt>
                <dd>
                  AVIF o WEBP si podés elegir: pesan mucho menos con la misma calidad. También
                  se aceptan JPG y PNG.
                </dd>

                <dt className="font-medium text-slate-700">Peso máximo</dt>
                <dd>5 MB. Si el original pesa más, exportalo de nuevo antes de subirlo.</dd>

                <dt className="font-medium text-slate-700">Encuadre</dt>
                <dd>
                  No hace falta recortar la imagen: después de subirla se elige el punto de
                  interés arrastrando sobre la vista previa.
                </dd>
              </dl>
            </div>

            {aviso ? (
              <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{aviso}</p>
            ) : null}
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
