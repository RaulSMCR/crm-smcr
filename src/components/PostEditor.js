"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SafeImage from "@/components/SafeImage";
import { IMAGE_FALLBACKS, PUBLIC_IMAGE_ACCEPT, SUPPORTED_PUBLIC_IMAGE_TYPES } from "@/lib/images";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FORMAT_ERROR = "Formato no soportado. Usa JPG, PNG, WEBP, GIF o AVIF.";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatBytes(bytes) {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PostEditor({ initial = null }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const isEdit = Boolean(initial?.id);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [coverImageTitle, setCoverImageTitle] = useState(initial?.coverImageTitle ?? "");
  const [coverImageAuthor, setCoverImageAuthor] = useState(initial?.coverImageAuthor ?? "");
  const [coverImageNote, setCoverImageNote] = useState(initial?.coverImageNote ?? "");
  const [previewUrl, setPreviewUrl] = useState(initial?.coverImage ?? "");
  const [imageName, setImageName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const slugPreview = useMemo(() => (title ? slugify(title) : "-"), [title]);
  const isWorking = busy || isPending || uploadingImage;

  function validate() {
    if (!title || title.trim().length < 4) return "El titulo debe tener al menos 4 caracteres.";
    if (!content || content.trim().length < 20) return "El contenido debe tener al menos 20 caracteres.";
    if (uploadingImage) return "Espera a que termine de subir la imagen.";
    return null;
  }

  async function uploadCoverImage(file) {
    setError(null);

    if (file.type && !SUPPORTED_PUBLIC_IMAGE_TYPES.includes(file.type)) {
      setError(IMAGE_FORMAT_ERROR);
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen no puede pesar mas de 5 MB.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setImageName(`${file.name} (${formatBytes(file.size)})`);
    setUploadingImage(true);

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);

      const response = await fetch("/api/upload/post-cover", {
        method: "POST",
        credentials: "include",
        body: uploadData,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "No fue posible subir la imagen.");

      setCoverImage(result.url);
      setPreviewUrl(result.url);
    } catch (uploadError) {
      setCoverImage(initial?.coverImage ?? "");
      setPreviewUrl(initial?.coverImage ?? "");
      setImageName("");
      setError(uploadError.message || "No fue posible subir la imagen.");
    } finally {
      setUploadingImage(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  function handleFiles(files) {
    const file = files?.[0];
    if (file) uploadCoverImage(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  }

  function removeImage() {
    setCoverImage("");
    setPreviewUrl("");
    setImageName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const msg = validate();
    if (msg) return setError(msg);

    const body = {
      title,
      content,
      coverImage: coverImage || null,
      coverImageTitle: coverImageTitle || null,
      coverImageAuthor: coverImageAuthor || null,
      coverImageNote: coverImageNote || null,
    };

    try {
      setBusy(true);
      const endpoint = isEdit ? `/api/professional/posts/${initial.id}` : "/api/posts";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);

      startTransition(() => {
        router.push("/panel/profesional");
        router.refresh();
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!isEdit) return;
    if (!confirm("Eliminar este articulo? Esta accion no se puede deshacer.")) return;

    try {
      setBusy(true);
      const res = await fetch(`/api/professional/posts/${initial.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);

      startTransition(() => {
        router.push("/panel/profesional");
        router.refresh();
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{isEdit ? "Editar articulo" : "Nuevo articulo"}</h1>
        <div className="text-sm text-gray-500">
          Slug (previa): <span className="font-mono">{slugPreview}</span>
        </div>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div>
        <label className="mb-1 block text-sm font-medium">Titulo *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="Escribe un titulo descriptivo"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Contenido *</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[180px] w-full rounded border px-3 py-2"
          placeholder="Escribe el contenido del articulo"
          required
        />
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Imagen de portada</h2>
          <p className="mt-1 text-xs text-slate-500">Arrastra una imagen o haz clic para subirla. Se guarda automaticamente.</p>
        </div>

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
          disabled={isWorking}
          className={[
            "relative flex min-h-[230px] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-left transition",
            dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40",
            isWorking ? "cursor-wait opacity-80" : "cursor-pointer",
          ].join(" ")}
        >
          {previewUrl ? (
            <>
              <SafeImage src={previewUrl} alt="" fallbackSrc={IMAGE_FALLBACKS.article} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-slate-950/35" />
              <div className="relative z-10 rounded bg-white/95 px-4 py-3 text-center shadow-sm">
                <div className="text-sm font-semibold text-slate-900">
                  {uploadingImage ? "Subiendo imagen..." : "Imagen lista"}
                </div>
                <div className="mt-1 text-xs text-slate-600">{imageName || "Haz clic o arrastra otra imagen para cambiarla"}</div>
              </div>
            </>
          ) : (
            <div className="px-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl text-slate-500 shadow-sm">+</div>
              <div className="mt-3 text-sm font-semibold text-slate-800">
                Suelta la imagen aqui
              </div>
              <div className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP, GIF o AVIF hasta 5 MB</div>
            </div>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={PUBLIC_IMAGE_ACCEPT}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
          disabled={isWorking}
        />

        {coverImage ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="truncate">Almacenada en el bucket.</span>
            <button type="button" onClick={removeImage} className="font-semibold text-red-600 hover:underline" disabled={isWorking}>
              Quitar
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Titulo de la imagen u obra</label>
            <input
              value={coverImageTitle}
              onChange={(e) => setCoverImageTitle(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Ej. La noche estrellada"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Autor</label>
            <input
              value={coverImageAuthor}
              onChange={(e) => setCoverImageAuthor(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Ej. Vincent van Gogh"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Descripcion o credito</label>
            <textarea
              value={coverImageNote}
              onChange={(e) => setCoverImageNote(e.target.value)}
              rows={3}
              className="w-full rounded border px-3 py-2"
              placeholder="Agrega contexto, tecnica, museo, fuente o permiso de uso."
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isWorking}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-70"
        >
          {uploadingImage ? "Subiendo imagen..." : isEdit ? "Guardar cambios" : "Enviar para aprobacion"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/panel/profesional")}
          className="rounded border px-4 py-2 hover:bg-gray-50"
          disabled={isWorking}
        >
          Cancelar
        </button>

        {isEdit ? (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-70"
            disabled={isWorking}
          >
            Eliminar
          </button>
        ) : null}
      </div>

      <p className="text-xs text-gray-500">
        Nota: al editar o crear, el articulo queda como <strong>borrador</strong> hasta que un administrador lo publique.
      </p>
    </form>
  );
}
