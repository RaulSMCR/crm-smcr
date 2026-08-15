import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { abrirCasoParaVisar } from "@/actions/caso-actions";
import { esDireccionClinica } from "@/lib/auth-guards";
import { ESTADOS } from "@/lib/casos";
import NotaDeCierre from "@/components/casos/NotaDeCierre";
import VisadoActions from "@/components/casos/VisadoActions";

export const dynamic = "force-dynamic";

// Abrir esta página ES el acceso al expediente, así que abrirCasoParaVisar deja
// el registro de lectura antes de devolver nada. No hay forma de leer sin que
// quede anotado: esa es la contrapartida exacta de lo que dice el acuerdo.

export default async function VisarCasoPage({ params }) {
  // En Next 16 params es una promesa.
  const { id } = await params;

  if (!(await esDireccionClinica())) redirect("/panel");

  const { caso, contactosDeReenganche = 0, error } = await abrirCasoParaVisar(id);
  if (error || !caso) notFound();

  const enVisado = caso.estado === ESTADOS.PENDIENTE_VISADO;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <Link href="/panel/direccion-clinica" className="text-sm text-brand-700 hover:underline">
        ← Cierres pendientes
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">{caso.pacienteNombre}</h1>
        <p className="mt-2 text-slate-600">
          Proceso con {caso.professional?.user?.name || "—"}, abierto el{" "}
          {new Date(caso.abiertoAt).toLocaleDateString("es-CR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>
      </div>

      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Tu lectura de este expediente quedó registrada en la bitácora del caso.
      </p>

      <NotaDeCierre caso={caso} />

      {/* Dato de contexto que cambia cómo se lee una baja por abandono: no es lo
          mismo si hubo un intento de contacto que si hubo seis. */}
      <p className="text-sm text-slate-600">
        Intentos de reenganche registrados para esta persona: <b>{contactosDeReenganche}</b>.
      </p>

      {enVisado ? (
        <VisadoActions casoId={caso.id} />
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Este caso ya no está esperando visado.
        </p>
      )}
    </div>
  );
}
