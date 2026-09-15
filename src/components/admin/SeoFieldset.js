"use client";

import { useEffect, useState } from "react";
import { SEO_LIMITS, TITLE_FIELD_LIMITS, TITLE_SUFFIX, tituloEnBuscador } from "@/lib/seo";

/**
 * Bloque colapsable de SEO editorial, reutilizable en cualquier editor.
 *
 * Funciona en los dos patrones de envío del proyecto:
 *   - Formularios con `new FormData(e.currentTarget)` (ej. ServiceEditForm):
 *     basta con montarlo dentro del <form>; cada input lleva su `name`.
 *   - Formularios que arman el submit a mano (AdminPostEditor, ProfileEditor):
 *     pasar `onChange(name, value)` para sincronizar el estado del padre.
 *
 * Los campos vacíos NO se envían como problema: el metadata cae al contenido
 * (ver resolveSeo en src/lib/seo.js). Los contadores solo orientan.
 */
function counterClass(len, { min, max }) {
  if (len === 0) return "text-slate-400";
  if (len < min || len > max) return "text-amber-600";
  return "text-emerald-600";
}

export default function SeoFieldset({ initialValues = {}, fallbackTitle = "", fallbackDescription = "", onChange }) {
  const [values, setValues] = useState({
    metaTitle: initialValues.metaTitle || "",
    metaDescription: initialValues.metaDescription || "",
    ogImage: initialValues.ogImage || "",
    focusKeyword: initialValues.focusKeyword || "",
    noindex: Boolean(initialValues.noindex),
  });

  useEffect(() => {
    setValues({
      metaTitle: initialValues.metaTitle || "",
      metaDescription: initialValues.metaDescription || "",
      ogImage: initialValues.ogImage || "",
      focusKeyword: initialValues.focusKeyword || "",
      noindex: Boolean(initialValues.noindex),
    });
  }, [
    initialValues.metaTitle,
    initialValues.metaDescription,
    initialValues.ogImage,
    initialValues.focusKeyword,
    initialValues.noindex,
  ]);

  function set(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    onChange?.(name, value);
  }

  const titleLen = values.metaTitle.trim().length;
  const descLen = values.metaDescription.trim().length;

  // El contador medía el campo contra 60 e ignoraba que el layout raíz le suma
  // « | Salud Mental Costa Rica». Un título que acá salía en verde llegaba al
  // buscador con 26 caracteres de más y se cortaba. Se mide contra lo que cabe
  // antes del sufijo, y además se muestra el resultado completo.
  const tituloFinal = tituloEnBuscador(values.metaTitle, fallbackTitle);

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer select-none text-sm font-bold text-slate-900">
        SEO on-page
        {values.noindex ? (
          <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            no indexable
          </span>
        ) : null}
      </summary>

      <p className="mt-2 text-xs text-slate-500">
        Si dejás un campo vacío, se usa automáticamente el contenido de la pieza.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Título SEO</label>
            <span className={`text-xs ${counterClass(titleLen, TITLE_FIELD_LIMITS)}`}>
              {titleLen}/{TITLE_FIELD_LIMITS.max}
            </span>
          </div>
          <input
            name="metaTitle"
            value={values.metaTitle}
            onChange={(e) => set("metaTitle", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={fallbackTitle || `Recomendado ${TITLE_FIELD_LIMITS.min}-${TITLE_FIELD_LIMITS.max} caracteres`}
          />
          <p className="mt-1 text-xs text-slate-500">
            El sitio le agrega <span className="font-mono">{TITLE_SUFFIX}</span> al final, así que el
            campo va sin la marca.
          </p>
          {tituloFinal ? (
            <p className={`mt-1 text-xs ${tituloFinal.length > SEO_LIMITS.title.max ? "text-amber-700" : "text-slate-500"}`}>
              En el buscador: «{tituloFinal}» ({tituloFinal.length} car.
              {tituloFinal.length > SEO_LIMITS.title.max ? " — Google lo va a cortar" : ""})
            </p>
          ) : null}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Meta descripción</label>
            <span className={`text-xs ${counterClass(descLen, SEO_LIMITS.description)}`}>
              {descLen}/{SEO_LIMITS.description.max}
            </span>
          </div>
          <textarea
            name="metaDescription"
            value={values.metaDescription}
            onChange={(e) => set("metaDescription", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={fallbackDescription ? `Ej.: ${fallbackDescription.slice(0, 120)}` : `Recomendado ${SEO_LIMITS.description.min}-${SEO_LIMITS.description.max} caracteres`}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Palabra clave objetivo</label>
            <input
              name="focusKeyword"
              value={values.focusKeyword}
              onChange={(e) => set("focusKeyword", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ej. psicólogo en Costa Rica"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Imagen social (OG)</label>
            <input
              name="ogImage"
              value={values.ogImage}
              onChange={(e) => set("ogImage", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="URL; por defecto usa la portada"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          {/* value="true" para que FormData lo capture solo si está marcado */}
          <input
            type="checkbox"
            name="noindex"
            value="true"
            checked={values.noindex}
            onChange={(e) => set("noindex", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          No indexar esta página (noindex) — se excluye del sitemap y de buscadores
        </label>
      </div>
    </details>
  );
}
