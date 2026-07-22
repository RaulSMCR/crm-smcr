"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAdminPost, updatePostStatus } from "@/actions/admin-actions";
import { notifyPostToReaders } from "@/actions/push-actions";
import SeoFieldset from "@/components/admin/SeoFieldset";
import SafeImage from "@/components/SafeImage";
import MarkdownEditor from "@/components/MarkdownEditor";
import { IMAGE_FALLBACKS, PUBLIC_IMAGE_ACCEPT, SUPPORTED_PUBLIC_IMAGE_TYPES } from "@/lib/images";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FORMAT_ERROR = "Formato no soportado. Usa JPG, PNG, WEBP, GIF o AVIF.";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function statusLabel(status) {
  return status === "PUBLISHED" ? "Publicado" : status === "ARCHIVED" ? "Archivado" : "Borrador";
}

function CoverPreview({ imageUrl, focusX, focusY, scale, title, subtitle, heightClass, onPickPosition }) {
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
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ${
          onPickPosition ? "cursor-grab active:cursor-grabbing" : ""
        } ${heightClass}`}
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
          if (touch) updateFromPointer(touch.clientX, touch.clientY);
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (touch) updateFromPointer(touch.clientX, touch.clientY);
        }}
      >
        {imageUrl ? (
          <>
            <SafeImage
              src={imageUrl}
              alt=""
              fallbackSrc={IMAGE_FALLBACKS.article}
              draggable="false"
              className="h-full w-full select-none object-cover"
              style={{
                objectPosition: `${focusX}% ${focusY}%`,
                transform: `scale(${scale / 100})`,
                transformOrigin: "center",
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/35" />
            <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/35" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/20" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm font-semibold text-slate-500">
            Sin imagen de portada
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPostEditor({ post }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [form, setForm] = useState({
    id: post.id,
    title: post.title || "",
    slug: post.slug || "",
    excerpt: post.excerpt || "",
    content: post.content || "",
    coverImage: post.coverImage || "",
    coverImageTitle: post.coverImageTitle || "",
    coverImageAuthor: post.coverImageAuthor || "",
    coverImageNote: post.coverImageNote || "",
    coverImageFocusX: post.coverImageFocusX ?? 50,
    coverImageFocusY: post.coverImageFocusY ?? 50,
    coverImageScale: post.coverImageScale ?? 100,
    metaTitle: post.metaTitle || "",
    metaDescription: post.metaDescription || "",
    ogImage: post.ogImage || "",
    focusKeyword: post.focusKeyword || "",
    noindex: post.noindex ?? false,
  });

  const busy = isPending || uploading;
  const isPublished = post.status === "PUBLISHED";

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save() {
    setError(null);
    setNotice(null);
    const result = await updateAdminPost(form);
    if (result?.error) {
      setError(result.error);
      return false;
    }
    setNotice("Articulo guardado.");
    startTransition(() => router.refresh());
    return true;
  }

  async function saveAndPublish() {
    const saved = await save();
    if (!saved) return;
    const result = await updatePostStatus(post.id, "PUBLISHED");
    if (result?.error) {
      setError(result.error);
      return;
    }
    setNotice("Articulo guardado y publicado.");
    startTransition(() => router.refresh());
  }

  async function togglePublished() {
    setError(null);
    setNotice(null);
    const result = await updatePostStatus(post.id, isPublished ? "DRAFT" : "PUBLISHED");
    if (result?.error) {
      setError(result.error);
      return;
    }
    setNotice(isPublished ? "Articulo despublicado." : "Articulo publicado.");
    startTransition(() => router.refresh());
  }

  async function notifyReaders() {
    setError(null);
    setNotice(null);
    const result = await notifyPostToReaders(post.id);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setNotice(
      `Notificación enviada: ${result.sent} de ${result.targets} lector${result.targets === 1 ? "" : "es"} con afinidad.`
    );
  }

  async function uploadImage(file) {
    setError(null);
    if (!file) return;
    if (file.type && !SUPPORTED_PUBLIC_IMAGE_TYPES.includes(file.type)) return setError(IMAGE_FORMAT_ERROR);
    if (file.size > MAX_IMAGE_BYTES) return setError("La imagen no puede pesar mas de 5 MB.");

    setUploading(true);
    const localPreview = URL.createObjectURL(file);
    updateField("coverImage", localPreview);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload/post-cover", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "No fue posible subir la imagen.");
      updateField("coverImage", data.url);
      updateField("coverImageFocusX", 50);
      updateField("coverImageFocusY", 50);
      updateField("coverImageScale", 100);
    } catch (uploadError) {
      updateField("coverImage", post.coverImage || "");
      setError(uploadError.message || "No fue posible subir la imagen.");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    uploadImage(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Edicion editorial</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Revisar articulo</h1>
            <p className="mt-1 text-sm text-slate-600">
              Autor: <span className="font-semibold">{post.author?.user?.name || "Desconocido"}</span>
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
            {statusLabel(post.status)}
          </span>
        </div>

        {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Titulo</label>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Slug publico</label>
          <input
            value={form.slug}
            onChange={(event) => updateField("slug", event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Resumen</label>
          <textarea
            value={form.excerpt}
            onChange={(event) => updateField("excerpt", event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Contenido</label>
          <MarkdownEditor
            value={form.content}
            onChange={(v) => updateField("content", v)}
            rows={18}
            placeholder="Contenido del artículo. Usa los botones de formato (título, negrita, lista…)."
          />
        </div>

        <SeoFieldset
          initialValues={form}
          fallbackTitle={form.title}
          fallbackDescription={form.excerpt}
          onChange={updateField}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Guardar edicion
          </button>
          <button
            type="button"
            onClick={saveAndPublish}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Guardar y publicar
          </button>
          <button
            type="button"
            onClick={togglePublished}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {isPublished ? "Despublicar" : "Publicar sin cambios"}
          </button>
          {isPublished ? (
            <button
              type="button"
              onClick={notifyReaders}
              disabled={busy}
              title="Push a lectores con afinidad (mismo autor, todavía no vieron este artículo)"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Notificar a lectores
            </button>
          ) : null}
          <Link href="/panel/admin/blog" className="ml-auto text-sm font-semibold text-slate-600 hover:text-slate-900">
            Volver
          </Link>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Portada y credito</h2>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
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
            disabled={busy}
            className={[
              "relative mt-3 flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-slate-50 text-center transition",
              dragActive ? "border-blue-500" : "border-slate-300 hover:border-blue-400",
            ].join(" ")}
          >
            {form.coverImage ? (
              <>
                <SafeImage src={form.coverImage} alt="" fallbackSrc={IMAGE_FALLBACKS.article} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-slate-950/30" />
                <span className="relative rounded bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800">
                  {uploading ? "Subiendo..." : "Cambiar imagen"}
                </span>
              </>
            ) : (
              <span className="px-4 text-sm font-semibold text-slate-600">Soltar o seleccionar portada</span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={PUBLIC_IMAGE_ACCEPT}
            className="hidden"
            onChange={(event) => uploadImage(event.target.files?.[0])}
          />

          <div className="mt-4 space-y-3">
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <CoverPreview
                imageUrl={form.coverImage}
                focusX={form.coverImageFocusX}
                focusY={form.coverImageFocusY}
                scale={form.coverImageScale}
                title="Vista publica desktop"
                subtitle="Hero del articulo"
                heightClass="aspect-[16/7] w-full"
                onPickPosition={(nextX, nextY) => {
                  updateField("coverImageFocusX", nextX);
                  updateField("coverImageFocusY", nextY);
                }}
              />

              <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                <CoverPreview
                  imageUrl={form.coverImage}
                  focusX={form.coverImageFocusX}
                  focusY={form.coverImageFocusY}
                  scale={form.coverImageScale}
                  title="Mobile"
                  subtitle="Recorte vertical"
                  heightClass="aspect-[4/5] w-full"
                  onPickPosition={(nextX, nextY) => {
                    updateField("coverImageFocusX", nextX);
                    updateField("coverImageFocusY", nextY);
                  }}
                />
                <div className="space-y-3">
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-semibold">Zoom</span>
                    <input
                      type="range"
                      min="100"
                      max="180"
                      value={form.coverImageScale}
                      onChange={(event) => updateField("coverImageScale", Number(event.target.value))}
                      className="w-full"
                    />
                    <span className="text-xs text-slate-500">{form.coverImageScale}%</span>
                  </label>
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-semibold">Posicion horizontal</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={form.coverImageFocusX}
                      onChange={(event) => updateField("coverImageFocusX", Number(event.target.value))}
                      className="w-full"
                    />
                    <span className="text-xs text-slate-500">X: {form.coverImageFocusX}%</span>
                  </label>
                  <label className="block text-sm text-slate-700">
                    <span className="mb-1 block font-semibold">Posicion vertical</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={form.coverImageFocusY}
                      onChange={(event) => updateField("coverImageFocusY", Number(event.target.value))}
                      className="w-full"
                    />
                    <span className="text-xs text-slate-500">Y: {form.coverImageFocusY}%</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      updateField("coverImageFocusX", 50);
                      updateField("coverImageFocusY", 50);
                      updateField("coverImageScale", 100);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Recentrar
                  </button>
                </div>
              </div>
            </div>

            <input
              value={form.coverImageTitle}
              onChange={(event) => updateField("coverImageTitle", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Titulo de la imagen u obra"
            />
            <input
              value={form.coverImageAuthor}
              onChange={(event) => updateField("coverImageAuthor", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Autor"
            />
            <textarea
              value={form.coverImageNote}
              onChange={(event) => updateField("coverImageNote", event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Descripcion, fuente o permiso de uso"
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Lectura rapida</h2>
          <article className="mt-3 max-h-[620px] overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-xl font-bold text-slate-950">{form.title}</h3>
            {form.excerpt ? <p className="mt-2 text-sm text-slate-600">{form.excerpt}</p> : null}
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-800">{form.content}</div>
          </article>
        </section>
      </aside>
    </div>
  );
}
