"use client";

import { useId, useState } from "react";

const FALLBACK_BANNER =
  "https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80&auto=format&fit=crop";

export default function ServiceBannerField({ serviceId = null, initialUrl = "" }) {
  const inputId = useId();
  const [bannerUrl, setBannerUrl] = useState(initialUrl || "");
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

  return (
    <div className="space-y-3">
      <input type="hidden" name="bannerImage" value={bannerUrl} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bannerUrl || FALLBACK_BANNER}
          alt="Vista previa del banner del servicio"
          className="h-48 w-full object-cover md:h-56"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {uploading ? "Subiendo..." : bannerUrl ? "Cambiar banner" : "Subir banner"}
        </label>
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
        <span className="text-xs text-slate-500">JPG, PNG o WebP. Maximo 5 MB.</span>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
