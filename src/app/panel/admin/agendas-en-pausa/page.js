import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listarAgendasEnPausa } from "@/actions/scheduling-block-actions";
import PausedSchedulesPanel from "@/components/admin/PausedSchedulesPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agendas en pausa" };

export default async function AgendasEnPausaPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const { pacientes = [] } = await listarAgendasEnPausa();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Agendas en pausa</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Pacientes que quedaron sin poder agendar por avisar con menos de 24 horas o por no
          asistir. La pausa no se levanta sola: contáctelos y devuélvales el acceso desde acá.
        </p>
      </div>

      <PausedSchedulesPanel pacientes={pacientes} />
    </div>
  );
}
