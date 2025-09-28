// src/components/PostEditor.js
'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const POST_TYPES = [
  { value: 'TEXT', label: 'Texto' },
  { value: 'VIDEO', label: 'Video (embed URL)' },
  { value: 'AUDIO', label: 'Audio (embed URL)' },
];

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function PostEditor({ initial = null }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [isPending, startTransition] = useTransition();

  // Campos
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [postType, setPostType] = useState(initial?.postType ?? 'TEXT');
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? '');
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? '');

  // Servicios para selector
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Slug preview
  const slugPreview = useMemo(() => (title ? slugify(title) : '—'), [title]);

  // Traer servicios (usamos tu endpoint existente)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingServices(true);
        const res = await fetch('/api/auth/services', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Error al cargar servicios');
        if (alive) setServices(Array.isArray(data) ? data : data?.data || []);
      } catch (e) {
        if (alive) setServices([]); // fallback vacío
      } finally {
        if (alive) setLoadingServices(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  function validate() {
    if (!title || title.trim().length < 4) return 'El título debe tener al menos 4 caracteres.';
    if (!content || content.trim().length < 20) return 'El contenido debe tener al menos 20 caracteres.';
    const upperType = String(postType || '').toUpperCase();
    if ((upperType === 'VIDEO' || upperType === 'AUDIO') && !mediaUrl) {
      return 'Para VIDEO o AUDIO debes indicar una URL de embed en “Media URL”.';
    }
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    const body = {
      title,
      content,
      imageUrl: imageUrl || null,
      postType: String(postType || 'TEXT').toUpperCase(),
      mediaUrl: mediaUrl || null,
      serviceId: serviceId ? Number(serviceId) : undefined,
    };

    try {
      setBusy(true);
      const endpoint = isEdit ? `/api/professional/posts/${initial.id}` : '/api/professional/posts';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);

      startTransition(() => {
        router.push('/dashboard-profesional');
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
    if (!confirm('¿Eliminar este artículo? Esta acción no se puede deshacer.')) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/professional/posts/${initial.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
      startTransition(() => {
        router.push('/dashboard-profesional');
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
        <h1 className="text-2xl font-bold">
          {isEdit ? 'Editar artículo' : 'Nuevo artículo'}
        </h1>
        <div className="text-sm text-gray-500">
          Slug (previa): <span className="font-mono">{slugPreview}</span>
        </div>
      </div>

      {error ? (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium mb-1">Título *</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="Escribe un título descriptivo"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Contenido *</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full border rounded px-3 py-2 min-h-[180px]"
          placeholder="Escribe el contenido del artículo"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Se recomienda mínimo 20–50 palabras.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Imagen (URL)</label>
          <input
            type="url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="https://…"
          />
          <p className="text-xs text-gray-500 mt-1">Opcional. Se muestra como portada en listados.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tipo de post *</label>
          <select
            value={postType}
            onChange={e => setPostType(e.target.value.toUpperCase())}
            className="w-full border rounded px-3 py-2"
            required
          >
            {POST_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Para VIDEO/AUDIO deberás completar el embed URL.</p>
        </div>
      </div>

      {(postType === 'VIDEO' || postType === 'AUDIO') && (
        <div>
          <label className="block text-sm font-medium mb-1">Media URL (embed) *</label>
          <input
            type="url"
            value={mediaUrl}
            onChange={e => setMediaUrl(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="https://www.youtube.com/embed/…  /  https://open.spotify.com/embed/episode/…"
            required
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Servicio asociado</label>
        <select
          value={serviceId ?? ''}
          onChange={e => setServiceId(e.target.value)}
          className="w-full border rounded px-3 py-2"
          disabled={loadingServices}
        >
          <option value="">— Ninguno —</option>
          {services.map(s => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Opcional. El artículo aparecerá también en la página del servicio.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy || isPending}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70"
        >
          {isEdit ? 'Guardar cambios' : 'Crear artículo'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/dashboard-profesional')}
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
        Nota: Los artículos nuevos quedan en <strong>PENDING</strong> para revisión del Admin.
      </p>
    </form>
  );
}
