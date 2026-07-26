"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownEditor from "@/components/MarkdownEditor";
import MarkdownFileImport from "@/components/blog/MarkdownFileImport";
import { createAdminPost } from "@/actions/admin-actions";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminPostCreator({ authors = [], defaultAuthorId = "" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [form, setForm] = useState({
    authorId: defaultAuthorId || (authors.length === 1 ? authors[0].id : ""),
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
    focusKeyword: "",
  });

  const busy = saving || isPending;
  const slugPreview = useMemo(() => form.slug || slugify(form.title) || "-", [form.slug, form.title]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleImport(parsed) {
    setError(null);
    setForm((current) => ({
      ...current,
      title: parsed.title || current.title,
      content: parsed.content || current.content,
      slug: parsed.slug || current.slug,
      excerpt: parsed.excerpt || current.excerpt,
      metaTitle: parsed.metaTitle || current.metaTitle,
      metaDescription: parsed.metaDescription || current.metaDescription,
      focusKeyword: parsed.focusKeyword || current.focusKeyword,
    }));
    if (parsed.crmMetadata) {
      window.dispatchEvent(new CustomEvent("crm:editorial-metadata", { detail: parsed.crmMetadata }));
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!form.authorId) return setError("Elegí el profesional que firma el artículo.");
    if (form.title.trim().length < 4) return setError("El título debe tener al menos 4 caracteres.");
    if (form.content.trim().length < 20) return setError("El contenido debe tener al menos 20 caracteres.");

    setSaving(true);
    const result = await createAdminPost(form);
    setSaving(false);

    if (result?.error) return setError(result.error);

    setNotice("Artículo creado como borrador. Abriendo el editor completo…");
    startTransition(() => {
      router.push(`/panel/admin/blog/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Edición editorial</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Nuevo artículo</h1>
          <p className="mt-1 text-sm text-slate-600">
            Escribilo aquí o importá un archivo <span className="font-mono">.md</span>. Se guarda como borrador; la
            portada, el SEO fino y la taxonomía se completan en el siguiente paso.
          </p>
        </div>

        {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {notice ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Firma el artículo *</label>
          <select
            value={form.authorId}
            onChange={(event) => updateField("authorId", event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          >
            <option value="">Elegir profesional…</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
                {author.specialty ? ` — ${author.specialty}` : ""}
                {author.isApproved ? "" : " (sin aprobar)"}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Todo artículo del blog se publica firmado por un profesional de la casa.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Título *</label>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Escribí un título descriptivo"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Slug (previa): <span className="font-mono">{slugPreview}</span>
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Slug público</label>
          <input
            value={form.slug}
            onChange={(event) => updateField("slug", event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            placeholder="Se genera del título si lo dejás vacío"
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
          <label className="mb-1 block text-sm font-semibold text-slate-700">Contenido *</label>
          <MarkdownEditor
            value={form.content}
            onChange={(value) => updateField("content", value)}
            rows={18}
            placeholder="Escribí el contenido del artículo, o importá un .md desde el panel de la derecha."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Creando…" : "Crear borrador y seguir editando"}
          </button>
          <Link href="/panel/admin/blog" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            Cancelar
          </Link>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Importar desde archivo</h2>
          <p className="mt-1 mb-3 text-xs text-slate-600">
            Traé un documento ya escrito. Rellena el título, el contenido y el SEO que venga en el archivo.
          </p>
          <MarkdownFileImport onImport={handleImport} />
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">SEO inicial</h2>
          <input
            value={form.metaTitle}
            onChange={(event) => updateField("metaTitle", event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Meta title"
          />
          <textarea
            value={form.metaDescription}
            onChange={(event) => updateField("metaDescription", event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Meta description"
          />
          <input
            value={form.focusKeyword}
            onChange={(event) => updateField("focusKeyword", event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Palabra clave principal"
          />
          <p className="text-xs text-slate-500">
            Opcional: si quedan vacíos, el metadata se deriva del contenido.
          </p>
        </section>
      </aside>
    </form>
  );
}
