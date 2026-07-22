"use client";

import { useRef, useState } from "react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

/**
 * Editor de texto con barra de formato (markdown) y vista previa.
 * Guarda markdown (compatible con el resto del blog); los botones evitan
 * tener que escribir la sintaxis a mano.
 */
export default function MarkdownEditor({ value, onChange, rows = 16, placeholder = "" }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(false);
  const text = value || "";

  function restore(selStart, selEnd) {
    setTimeout(() => {
      const ta = ref.current;
      if (!ta) return;
      ta.focus();
      ta.selectionStart = selStart;
      ta.selectionEnd = selEnd;
    }, 0);
  }

  // Envuelve la selección con `sym` (negrita/cursiva).
  function surround(sym) {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = text.slice(s, e) || "texto";
    onChange(text.slice(0, s) + sym + sel + sym + text.slice(e));
    restore(s + sym.length, s + sym.length + sel.length);
  }

  // Antepone `prefix` al inicio de la línea actual (título/lista/cita).
  function prefixLine(prefix) {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = text.lastIndexOf("\n", s - 1) + 1;
    onChange(text.slice(0, lineStart) + prefix + text.slice(lineStart));
    restore(s + prefix.length, s + prefix.length);
  }

  function insertAtCursor(snippet, cursorOffset) {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    onChange(text.slice(0, s) + snippet + text.slice(e));
    const pos = s + (cursorOffset ?? snippet.length);
    restore(pos, pos);
  }

  const Btn = ({ onClick, title, children }) => (
    <button
      type="button"
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={onClick}
      title={title}
      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 p-2">
        <Btn onClick={() => prefixLine("## ")} title="Título">Título</Btn>
        <Btn onClick={() => prefixLine("### ")} title="Subtítulo">Subtítulo</Btn>
        <Btn onClick={() => surround("**")} title="Negrita"><strong>N</strong></Btn>
        <Btn onClick={() => surround("*")} title="Cursiva"><em>C</em></Btn>
        <Btn onClick={() => prefixLine("- ")} title="Lista">• Lista</Btn>
        <Btn onClick={() => prefixLine("1. ")} title="Lista numerada">1. Núm.</Btn>
        <Btn onClick={() => prefixLine("> ")} title="Cita">❝ Cita</Btn>
        <Btn onClick={() => insertAtCursor("[texto](https://)", 1)} title="Enlace">🔗 Enlace</Btn>
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="ml-auto rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          {preview ? "✎ Editar" : "👁 Vista previa"}
        </button>
      </div>

      {preview ? (
        <div className="prose prose-slate max-w-none p-4">
          <MarkdownRenderer content={text || "_(sin contenido)_"} />
        </div>
      ) : (
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="block w-full resize-y rounded-b-lg border-0 p-3 font-serif text-sm leading-relaxed text-slate-900 focus:outline-none focus:ring-0"
        />
      )}
    </div>
  );
}
