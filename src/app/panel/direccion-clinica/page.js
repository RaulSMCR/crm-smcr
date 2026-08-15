import Link from "next/link";
import { redirect } from "next/navigation";
import { listarCierresPendientes } from "@/actions/caso-actions";
import { esDireccionClinica } from "@/lib/auth-guards";
import { RESULTADOS, TIPOS_CIERRE } from "@/lib/casos";

export const dynamic = "force-dynamic";

// Bandeja de la dirección clínica.
//
// No cuelga del rol ADMIN: quien entra acá tiene que tener colegiatura
// registrada, porque lo que habilita a abrir un expediente no es el puesto en la
// plataforma sino la habilitación profesional. Ver lib/auth-guards.

function dias(desde) {
  if (!desde) return 0;
  return Math.floor((Date.now() - new Date(desde).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function DireccionClinicaPage() {
  if (!(await esDireccionClinica())) redirect("/panel");

  const { casos = [] } = await listarCierresPendientes();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dirección clínica</h1>
        <p className="mt-2 text-slate-600">
          Altas y bajas esperando visado. Cada expediente que abrís queda registrado con tu nombre y
          tu número de colegiado: es lo que se le prometió a la persona en el acuerdo.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">
          Cierres pendientes {casos.length > 0 ? `(${casos.length})` : ""}
        </h2>

        {casos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nada pendiente por ahora.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {casos.map((caso) => {
              const espera = dias(caso.cierrePropuestoAt);
              return (
                <li key={caso.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link
                      href={`/panel/direccion-clinica/${caso.id}`}
                      className="font-semibold text-brand-800 hover:underline"
                    >
                      {caso.pacienteNombre}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {TIPOS_CIERRE[caso.tipoCierre]?.label || caso.tipoCierre} ·{" "}
                      {caso.professional?.user?.name || "—"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        caso.resultado === RESULTADOS.ALTA
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {caso.resultado === RESULTADOS.ALTA ? "Alta" : "Baja"}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        espera >= 7 ? "text-accent-800" : "text-slate-500"
                      }`}
                    >
                      {espera === 0 ? "hoy" : `hace ${espera} d`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
