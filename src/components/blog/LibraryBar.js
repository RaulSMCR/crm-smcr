// src/components/blog/LibraryBar.js
// Barra de organización de la biblioteca. Server component: todo se navega por
// URL con <Link>, así los filtros se comparten con un enlace y funcionan igual
// para los tres tipos de usuario, sin JavaScript.

import Link from "next/link";
import { LIBRARY_SORTS, libraryHref } from "@/lib/blog-taxonomy";

function ChipLink({ href, active, children }) {
  // El fondo del chip inactivo va por estilo inline a propósito: una regla
  // global de marca en globals.css repinta a teal cualquier <a> con clase
  // `bg-white`, lo que hacía que activo e inactivo se vieran iguales.
  const cls = active
    ? "border-brand-600 bg-brand-600 text-white"
    : "border-slate-300 text-slate-700 hover:border-brand-400";
  return (
    <Link
      href={href}
      className={`rounded-nv border px-3 py-1.5 text-sm transition ${cls}`}
      style={active ? undefined : { backgroundColor: "#fff" }}
    >
      {children}
    </Link>
  );
}

function Group({ label, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </div>
  );
}

export default function LibraryBar({ params, vocab, authors, complementary }) {
  const hasFilters = params.autor || params.disciplina || params.tema || params.serie || params.q;

  return (
    <div className="mb-10 space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-5">
      {/* Búsqueda + orden */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form action="/blog" method="get" className="flex w-full max-w-md items-center gap-2">
          {params.autor ? <input type="hidden" name="autor" value={params.autor} /> : null}
          {params.disciplina ? <input type="hidden" name="disciplina" value={params.disciplina} /> : null}
          {params.tema ? <input type="hidden" name="tema" value={params.tema} /> : null}
          {params.serie ? <input type="hidden" name="serie" value={params.serie} /> : null}
          {params.sort && params.sort !== "recientes" ? <input type="hidden" name="orden" value={params.sort} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={params.q || ""}
            placeholder="Buscar en la biblioteca…"
            className="input w-full"
            aria-label="Buscar artículos"
          />
          <button type="submit" className="btn btn-outline shrink-0">Buscar</button>
        </form>

        <Group label="Ordenar">
          {Object.entries(LIBRARY_SORTS).map(([key, label]) => (
            <ChipLink key={key} href={libraryHref(params, { sort: key })} active={params.sort === key}>
              {label}
            </ChipLink>
          ))}
        </Group>
      </div>

      {authors?.length ? (
        <Group label="Autor">
          {authors.map((a) => (
            <ChipLink key={a.slug} href={libraryHref(params, { autor: params.autor === a.slug ? null : a.slug })} active={params.autor === a.slug}>
              {a.name}
            </ChipLink>
          ))}
        </Group>
      ) : null}

      {vocab.disciplines?.length ? (
        <Group label="Disciplina">
          {vocab.disciplines.map((d) => (
            <ChipLink key={d.slug} href={libraryHref(params, { disciplina: params.disciplina === d.slug ? null : d.slug })} active={params.disciplina === d.slug}>
              {d.name}
            </ChipLink>
          ))}
        </Group>
      ) : null}

      {vocab.topics?.length ? (
        <Group label="Tema">
          {vocab.topics.map((t) => (
            <ChipLink key={t.slug} href={libraryHref(params, { tema: params.tema === t.slug ? null : t.slug })} active={params.tema === t.slug}>
              {t.name}
            </ChipLink>
          ))}
        </Group>
      ) : null}

      {vocab.series?.length ? (
        <Group label="Serie">
          {vocab.series.map((s) => (
            <ChipLink key={s.slug} href={libraryHref(params, { serie: params.serie === s.slug ? null : s.slug })} active={params.serie === s.slug}>
              {s.name}
            </ChipLink>
          ))}
        </Group>
      ) : null}

      {/* Temas complementarios del tema seleccionado. */}
      {params.tema && complementary?.length ? (
        <Group label="Temas complementarios">
          {complementary.map((t) => (
            <ChipLink key={t.slug} href={libraryHref(params, { tema: t.slug })} active={false}>
              {t.name}
            </ChipLink>
          ))}
        </Group>
      ) : null}

      {hasFilters ? (
        <div className="pt-1">
          <Link href="/blog" className="text-sm font-semibold text-brand-700 hover:underline">
            Limpiar filtros
          </Link>
        </div>
      ) : null}
    </div>
  );
}
