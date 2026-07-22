"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EXAMPLE_SPEC, validateSpecJson, slugify } from "@/lib/carousel-spec";

export default function NewCarouselForm() {
  const router = useRouter();
  const [tab, setTab] = useState("manual"); // "manual" | "article"

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [specText, setSpecText] = useState(() => JSON.stringify(EXAMPLE_SPEC, null, 2));
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pestaña "Desde artículo"
  const [articleText, setArticleText] = useState("");
  const [notes, setNotes] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftInfo, setDraftInfo] = useState("");
  const [posts, setPosts] = useState([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [sourceNote, setSourceNote] = useState("");

  const validation = useMemo(() => validateSpecJson(specText), [specText]);
  const derivedSlug = slug.trim() || slugify(title);

  function onMdUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setArticleText(String(reader.result || ""));
      setSourceNote(`Cargado: ${file.name}`);
      setDraftError("");
    };
    reader.onerror = () => setDraftError("No se pudo leer el archivo.");
    reader.readAsText(file);
  }

  async function loadPostsOnce() {
    if (postsLoaded) return;
    setPostsLoaded(true);
    try {
      const res = await fetch("/api/admin/carousels/source-posts");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPosts(data.posts || []);
    } catch {
      // silencioso: el usuario puede pegar texto igual
    }
  }

  async function onPickPost(e) {
    const id = e.target.value;
    setSelectedPostId(id);
    if (!id) return;
    setDraftError("");
    try {
      const res = await fetch(`/api/admin/carousels/source-posts?id=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDraftError(data.message || "No se pudo cargar el artículo del blog.");
        return;
      }
      setArticleText(data.text || "");
      setSourceNote(`Desde el blog: ${data.title}`);
    } catch (err) {
      setDraftError(String(err));
    }
  }

  async function generateDraft() {
    setDraftError("");
    setDraftInfo("");
    if (articleText.trim().length < 80) {
      setDraftError("Pega el texto del artículo (al menos ~80 caracteres).");
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch("/api/admin/carousels/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleText: articleText.trim(), notes: notes.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.errors) ? ` (${data.errors.join("; ")})` : data.detail ? ` — ${data.detail}` : "";
        setDraftError(`${data.message || "No se pudo generar la propuesta"}${detail}`);
        setDrafting(false);
        return;
      }
      // Precargar el editor con la propuesta. Nunca genera PNGs: pasa por revisión.
      setSpecText(JSON.stringify(data.spec, null, 2));
      if (data.spec?.title && !title.trim()) setTitle(data.spec.title);
      setDraftInfo(`Propuesta generada con ${data.model}. Revísala y ajústala antes de crear.`);
      setTab("manual");
    } catch (err) {
      setDraftError(String(err));
    } finally {
      setDrafting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    if (!title.trim()) {
      setServerError("El título es obligatorio.");
      return;
    }
    if (!validation.ok) {
      setServerError("Corrige los errores de la spec antes de crear.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/carousels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim() || undefined,
          spec: validation.data,
          // Si hubo artículo fuente, lo guardamos para poder "Enviar al blog" luego.
          sourceText: articleText.trim() || undefined,
          sourcePostId: selectedPostId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.errors) ? ` (${data.errors.join("; ")})` : "";
        setServerError(`${data.message || "No se pudo crear el carrusel"}${detail}`);
        setSubmitting(false);
        return;
      }
      router.push(`/panel/admin/carousels/${data.id}`);
    } catch (err) {
      setServerError(String(err));
      setSubmitting(false);
    }
  }

  const tabBtn = (id, label) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      tab === id
        ? "bg-brand-700 text-white"
        : "border border-neutral-300 bg-white text-neutral-800 hover:border-brand-400"
    }`;

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("manual")} className={tabBtn("manual", "Manual")}>
          Spec manual
        </button>
        <button type="button" onClick={() => setTab("article")} className={tabBtn("article", "Desde artículo")}>
          Desde artículo
        </button>
      </div>

      {tab === "article" ? (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Pega el texto, sube un <strong>.md</strong> o elige un <strong>artículo del blog</strong>. Claude
            propondrá una spec siguiendo la guía editorial. La propuesta precarga el editor manual para
            revisión: <strong>nunca genera imágenes automáticamente.</strong>
          </p>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Fuente</span>
            <label className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 transition hover:border-brand-400">
              Subir .md
              <input
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="hidden"
                onChange={onMdUpload}
              />
            </label>
            <select
              value={selectedPostId}
              onChange={onPickPost}
              onMouseDown={loadPostsOnce}
              onFocus={loadPostsOnce}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-brand-500 focus:outline-none"
            >
              <option value="">Desde el blog…</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.status && p.status !== "PUBLISHED" ? ` (${p.status})` : ""}
                </option>
              ))}
            </select>
            {sourceNote ? <span className="text-xs text-neutral-500">{sourceNote}</span> : null}
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Artículo</span>
            <textarea
              value={articleText}
              onChange={(e) => setArticleText(e.target.value)}
              rows={14}
              placeholder="Pega aquí el texto completo del artículo…"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Notas (opcional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ángulo, tono, CTA específico…"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none"
            />
          </label>
          {draftError ? (
            <p className="rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-900">
              {draftError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={generateDraft}
            disabled={drafting || articleText.trim().length < 80}
            className="rounded-lg bg-accent-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {drafting ? "Generando propuesta…" : "Generar propuesta"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {draftInfo ? (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {draftInfo}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="El giro de la salud mental"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Slug (opcional)</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={derivedSlug || "se-deriva-del-titulo"}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 focus:border-brand-500 focus:outline-none"
              />
              <span className="mt-1 block text-xs text-neutral-500">
                {slug.trim() ? "" : derivedSlug ? `Se usará: ${derivedSlug}` : "Se derivará del título"}
              </span>
            </label>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Spec (JSON)</span>
              <span className={`text-xs font-semibold ${validation.ok ? "text-emerald-600" : "text-accent-700"}`}>
                {validation.ok ? "Spec válida ✓" : `${validation.errors.length} error(es)`}
              </span>
            </div>
            <textarea
              value={specText}
              onChange={(e) => setSpecText(e.target.value)}
              spellCheck={false}
              rows={22}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-950 px-3 py-2 font-mono text-xs leading-relaxed text-neutral-100 focus:border-brand-500 focus:outline-none"
            />
            {!validation.ok ? (
              <ul className="mt-2 space-y-1 rounded-lg border border-accent-200 bg-accent-50 p-3 text-xs text-accent-900">
                {validation.errors.map((msg, i) => (
                  <li key={i} className="font-mono">• {msg}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {serverError ? (
            <p className="rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-900">
              {serverError}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !validation.ok || !title.trim()}
              className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creando…" : "Crear carrusel"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/panel/admin/carousels")}
              className="rounded-lg border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
