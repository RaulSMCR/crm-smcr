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
  const [loaded, setLoaded] = useState(false);
  const [authorId, setAuthorId] = useState("");
  const [title, setTitle] = useState(defaultTitle || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const alreadyOnBlog = Boolean(sourcePostId); // la fuente ya era un post del blog
  const needsForm = hasSource && !alreadyOnBlog && !postId;

  useEffect(() => {
    if (!needsForm || loaded) return;
    setLoaded(true);
    (async () => {
      try {
        const res = await fetch("/api/admin/professionals");
        const data = await res.json().catch(() => []);
        if (res.ok && Array.isArray(data)) {
          setProfessionals(data.filter((p) => p.isApproved));
        }
      } catch {
        // silencioso
      }
    })();
  }, [needsForm, loaded]);

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
          Enviado al blog como <strong>borrador</strong>.{" "}
          <Link href={`/panel/admin/blog/${postId}`} className="font-semibold text-brand-700 hover:text-brand-900">
            Editar el artículo →
          </Link>{" "}
          (asigna la portada y publícalo desde el editor de blog).
        </p>
      ) : hasSource ? (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Crea un borrador de artículo en el blog con el texto fuente de este carrusel. Elige quién lo firma;
            la portada y la publicación se definen luego en el editor de blog.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Autor</span>
              <select
                value={authorId}
                onChange={(e) => setAuthorId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="">Elegir profesional…</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.profession ? ` — ${p.profession}` : ""}
                  </option>
                ))}
              </select>
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
            {sending ? "Enviando…" : "Enviar al blog (borrador)"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          Este carrusel se creó desde una spec manual (sin artículo fuente), así que no hay texto para enviar al blog.
        </p>
      )}
    </section>
  );
}
