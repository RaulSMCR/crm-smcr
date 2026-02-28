import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/actions/auth-actions";
import ServiceCreateForm from "@/components/admin/ServiceCreateForm";

export const dynamic = "force-dynamic";

export default async function AdminServicioNuevoPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <div className="text-sm text-slate-600">
          <Link href="/panel/admin/servicios" className="hover:underline">
            ← Volver a servicios
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mt-2">Crear nuevo servicio</h1>

        <p className="text-slate-600 mt-3">
          Completá los campos obligatorios para crear un nuevo servicio. Podés editarlo después.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900">Información del servicio</h2>
        <p className="text-sm text-slate-600 mt-1 mb-5">
          Título, precio y duración son obligatorios.
        </p>
        <ServiceCreateForm />
      </div>
    </div>
  );
}
