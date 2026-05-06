"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAdminPost, updatePostStatus } from "@/actions/admin-actions";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function statusLabel(status) {
  return status === "PUBLISHED" ? "Publicado" : status === "ARCHIVED" ? "Archivado" : "Borrador";
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

  async function uploadImage(file) {
    setError(null);
    if (!file) return;
    if (!file.type?.startsWith("image/")) return setError("El archivo debe ser una imagen.");
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
          <textarea
            value={form.content}
            onChange={(event) => updateField("content", event.target.value)}
            rows={18}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-serif leading-relaxed"
          />
        </div>

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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
            accept="image/*"
            className="hidden"
            onChange={(event) => uploadImage(event.target.files?.[0])}
          />

          <div className="mt-4 space-y-3">
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
