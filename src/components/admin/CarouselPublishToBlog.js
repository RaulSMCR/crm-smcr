"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CarouselPublishToBlog({
  carouselId,
  defaultTitle,
  hasSource,
  sourcePostId,
  blogPostId,
}) {
  const [postId, setPostId] = useState(blogPostId || null);
  const [professionals, setProfessionals] = useState([]);
  const [loadingPros, setLoadingPros] = useState(true);
  const [prosError, setProsError] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [title, setTitle] = useState(defaultTitle || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const alreadyOnBlog = Boolean(sourcePostId); // la fuente ya era un post del blog
  const showForm = !alreadyOnBlog && !postId;

  useEffect(() => {
    if (!showForm) return;
    let active = true;
    (async () => {
      setLoadingPros(true);
      setProsError("");
      try {
        const res = await fetch("/api/admin/professionals");
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (res.ok && Array.isArray(data)) {
          setProfessionals(data.filter((p) => p.isApproved));
        } else {
          setProsError((data && data.message) || "No se pudo cargar la lista de profesionales.");
        }
      } catch (err) {
        if (active) setProsError(String(err));
      } finally {
        if (active) setLoadingPros(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [showForm]);

  async function sendToBlog() {
    setError("");
    if (!authorId) {
      setError("Elige un autor.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/admin/carousels/${carouselId}/publish-to-blog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId, title: title.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.postId) setPostId(data.postId); // ya existía
        setError(data.message || "No se pudo enviar al blog");
      } else {
        setPostId(data.postId);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
      <h2 className="mb-1 text-lg font-bold text-neutral-950">Artículo en el blog</h2>

      {alreadyOnBlog ? (
        <p className="text-sm text-neutral-700">
          El artículo fuente ya es una entrada del blog.{" "}
          <Link href={`/panel/admin/blog/${sourcePostId}`} className="font-semibold text-brand-700 hover:text-brand-900">
            Abrir en el blog →
          </Link>
        </p>
      ) : postId ? (
        <p className="text-sm text-neutral-700">
          Creado en el blog como <strong>borrador</strong>.{" "}
          <Link href={`/panel/admin/blog/${postId}`} className="font-semibold text-brand-700 hover:text-brand-900">
            Editar el artículo →
          </Link>{" "}
          (portada, contenido, descripción y publicación se definen en el editor de blog).
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Crea la entrada de blog de este carrusel y elige quién la firma. La portada, la descripción y la
            publicación se trabajan luego en el editor de blog.
            {hasSource ? (
              " El borrador se precarga con el texto fuente del carrusel."
            ) : (
              " Este carrusel no tiene artículo fuente: se crea un borrador vacío para redactarlo en el editor."
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Autor</span>
              <select
                value={authorId}
                onChange={(e) => setAuthorId(e.target.value)}
                disabled={loadingPros}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none disabled:opacity-60"
              >
                <option value="">{loadingPros ? "Cargando…" : "Elegir profesional…"}</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.profession ? ` — ${p.profession}` : ""}
                  </option>
                ))}
              </select>
              {!loadingPros && professionals.length === 0 && !prosError ? (
                <span className="mt-1 block text-xs text-accent-700">
                  No hay profesionales aprobados. Aprueba alguno en Personal / Gestión editorial.
                </span>
              ) : null}
              {prosError ? <span className="mt-1 block text-xs text-accent-700">{prosError}</span> : null}
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none"
              />
            </label>
          </div>
          {error ? (
            <p className="rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-900">
              {error}
            </p>
          ) : null}
          <button
            onClick={sendToBlog}
            disabled={sending || !authorId}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Creando…" : "Crear artículo en el blog (borrador)"}
          </button>
        </div>
      )}
    </section>
  );
}
