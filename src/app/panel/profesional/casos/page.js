import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listarMisCasos } from "@/actions/caso-actions";
import { ESTADOS, RESULTADOS, TIPOS_CIERRE } from "@/lib/casos";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO = {
  [ESTADOS.ABIERTO]: { texto: "En curso", clase: "border-brand-200 bg-brand-50 text-brand-800" },
  [ESTADOS.PENDIENTE_VISADO]: {
    texto: "Esperando visado",
    clase: "border-amber-300 bg-amber-50 text-amber-900",
  },
  [ESTADOS.CERRADO]: { texto: "Cerrado", clase: "border-neutral-200 bg-neutral-50 text-neutral-600" },
};

function fecha(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function CasosPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "PROFESSIONAL") redirect("/");

  const { casos = [], error } = await listarMisCasos();

  const enCurso = casos.filter((c) => c.estado !== ESTADOS.CERRADO);
  const cerrados = casos.filter((c) => c.estado === ESTADOS.CERRADO);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Casos</h1>
        <p className="mt-2 text-slate-600">
          Cada persona que atendés lleva un proceso propio. Se abre solo con la primera cita, y se
          cierra con alta o con baja, con el visto bueno de la dirección clínica.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">En curso</h2>

        {enCurso.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Todavía no hay procesos abiertos. El primero se abre solo cuando reserven la primera
            cita con vos.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {enCurso.map((caso) => {
              const etiqueta = ETIQUETA_ESTADO[caso.estado] || ETIQUETA_ESTADO[ESTADOS.ABIERTO];
              return (
                <li key={caso.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link
                      href={`/panel/profesional/casos/${caso.id}`}
                      className="font-semibold text-brand-800 hover:underline"
                    >
                      {caso.pacienteNombre}
                    </Link>
                    <p className="text-sm text-slate-500">Desde el {fecha(caso.abiertoAt)}</p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${etiqueta.clase}`}
                  >
                    {etiqueta.texto}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {cerrados.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Cerrados</h2>
          <p className="mt-1 text-sm text-slate-600">
            Se conservan diez años desde el cierre. No se editan: si hace falta corregir algo, se
            agrega una adenda.
          </p>

          <ul className="mt-4 divide-y divide-slate-100">
            {cerrados.map((caso) => (
              <li key={caso.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/panel/profesional/casos/${caso.id}`}
                    className="font-semibold text-brand-800 hover:underline"
                  >
                    {caso.pacienteNombre}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {TIPOS_CIERRE[caso.tipoCierre]?.label || "Cerrado"} · {fecha(caso.cerradoAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    caso.resultado === RESULTADOS.ALTA
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-neutral-200 bg-neutral-50 text-neutral-600"
                  }`}
                >
                  {caso.resultado === RESULTADOS.ALTA ? "Alta" : "Baja"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
