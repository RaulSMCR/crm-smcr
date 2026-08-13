"use client";

import { useRef, useState } from "react";
import { isMarkdownFileName, parseMarkdownDocument } from "@/lib/markdown-document";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Importa un artículo desde un archivo .md del equipo del usuario: arrastrando
 * el archivo sobre la zona o buscándolo con el explorador. Devuelve los campos
 * ya separados (título, contenido, SEO) por `onImport`; quien lo usa decide
 * cómo llenar su formulario.
 */
export default function MarkdownFileImport({ onImport, compact = false }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  async function readFile(file) {
    setError(null);
    setStatus(null);

    if (!file) return;
    if (!isMarkdownFileName(file.name)) {
      setError("Solo se pueden importar archivos .md, .markdown o .txt.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("El archivo no puede pesar más de 2 MB.");
      return;
    }

    setReading(true);
    try {
      const text = await file.text();
      const parsed = parseMarkdownDocument(text, file.name);
      onImport(parsed);

      const detected = [
        parsed.title ? "título" : null,
        parsed.slug ? "slug" : null,
        parsed.metaTitle || parsed.metaDescription || parsed.focusKeyword || parsed.ogImage || parsed.noindex ? "SEO" : null,
        parsed.excerpt ? "resumen" : null,
        parsed.seriesName || parsed.seriesOrder ? "serie/parte" : null,
      ].filter(Boolean);

      setStatus(
        [
          `Importado ${file.name}.`,
          detected.length ? `Se detectó ${detected.join(", ")}.` : null,
          ...parsed.warnings,
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (readError) {
      console.error("Error leyendo el archivo markdown:", readError);
      setError("No se pudo leer el archivo.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    readFile(event.dataTransfer?.files?.[0]);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        disabled={reading}
        className={[
          "flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition",
          compact ? "gap-1 px-4 py-4" : "gap-2 px-4 py-8",
          dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40",
          reading ? "cursor-wait opacity-70" : "cursor-pointer",
        ].join(" ")}
      >
        <span className="text-sm font-semibold text-slate-800">
          {reading ? "Leyendo el archivo…" : "Arrastrá un archivo .md aquí"}
        </span>
        <span className="text-xs text-slate-500">
          o hacé clic para buscarlo en tu equipo · .md, .markdown o .txt hasta 2 MB
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.mdown,.mdx,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={(event) => readFile(event.target.files?.[0])}
      />

      {error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
      {status ? <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{status}</p> : null}
      <p className="text-xs text-slate-500">
        Se reconocen el front matter YAML (<span className="font-mono">title</span>,{" "}
        <span className="font-mono">slug</span>, <span className="font-mono">meta_description</span>…), el bloque
        &ldquo;Metadatos para CRM&rdquo; y el primer título del documento. El contenido reemplaza lo que haya en el editor.
      </p>
    </div>
  );
}
