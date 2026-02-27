"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function PostEditor({ initial = null }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const slugPreview = useMemo(() => (title ? slugify(title) : "—"), [title]);

  function validate() {
    if (!title || title.trim().length < 4) return "El título debe tener al menos 4 caracteres.";
    if (!content || content.trim().length < 20) return "El contenido debe tener al menos 20 caracteres.";
    return null;
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
    if (!confirm("¿Eliminar este artículo? Esta acción no se puede deshacer.")) return;

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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? "Editar artículo" : "Nuevo artículo"}</h1>
        <div className="text-sm text-gray-500">
          Slug (previa): <span className="font-mono">{slugPreview}</span>
        </div>
      </div>

      {error ? <div className="border border-red-200 bg-red-50 text-red-700 rounded p-3 text-sm">{error}</div> : null}

      <div>
        <label className="block text-sm font-medium mb-1">Título *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="Escribe un título descriptivo"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Contenido *</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full border rounded px-3 py-2 min-h-[180px]"
          placeholder="Escribe el contenido del artículo"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Imagen portada (URL)</label>
        <input
          type="url"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="https://…"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy || isPending}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70"
        >
          {isEdit ? "Guardar cambios" : "Enviar para aprobación"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/panel/profesional")}
          className="px-4 py-2 rounded border hover:bg-gray-50"
          disabled={busy || isPending}
        >
          Cancelar
        </button>

        {isEdit ? (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-70"
            disabled={busy || isPending}
          >
            Eliminar
          </button>
        ) : null}
      </div>

      <p className="text-xs text-gray-500">
        Nota: al editar o crear, el artículo queda como <strong>borrador</strong> hasta que un administrador lo publique.
      </p>
    </form>
  );
}
