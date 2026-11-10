import Link from "next/link";

/**
 * Enlaces de lectura (ver src/lib/enlaces-de-lectura.js). En la home es una
 * franja propia; al pie de un artículo, un bloque más de «seguir leyendo».
 *
 * @param {{ enlaces: Array<{ href: string, titulo: string, bajada: string, clave: string }>,
 *           variante?: "home" | "articulo" }} props
 */
export default function ParaEntender({ enlaces = [], variante = "home" }) {
  if (!enlaces.length) return null;

  if (variante === "articulo") {
    return (
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <nav aria-label="Seguir leyendo" className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Seguir leyendo</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {enlaces.map((e) => (
              <li key={e.clave}>
                <Link href={e.href} className="group block h-full rounded-xl border border-slate-200 p-3 transition hover:border-brand-400 hover:shadow-sm">
                  <span className="block font-semibold text-slate-900 group-hover:text-brand-700">{e.titulo}</span>
                  <span className="mt-1 block text-sm text-slate-600">{e.bajada}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    );
  }

  return (
    <section aria-labelledby="para-entender" className="bg-neutral-50 py-14">
      <div className="container">
        <h2 id="para-entender" className="text-3xl font-bold text-brand-900">Para entender</h2>
        <p className="mt-2 text-sm text-neutral-700">Lecturas para empezar, antes de consultar o en lugar de hacerlo todavía.</p>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {enlaces.map((e) => (
            <li key={e.clave}>
              <Link
                href={e.href}
                className="group block h-full rounded-2xl border border-neutral-300 bg-white p-5 no-underline transition hover:border-brand-400 hover:no-underline hover:shadow-sm"
              >
                <span className="block text-lg font-semibold leading-snug text-neutral-950 group-hover:underline">{e.titulo}</span>
                <span className="mt-2 block text-sm text-neutral-700">{e.bajada}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
