import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import ReconciliationPanel from "@/components/admin/ReconciliationPanel";

export const dynamic = "force-dynamic";
export default async function ReconciliationPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  return <main className="mx-auto max-w-6xl space-y-6 p-6"><div><a href="/panel/admin/contabilidad" className="text-sm text-slate-500">Volver a contabilidad</a><h1 className="mt-2 text-3xl font-bold">Conciliación ONVO</h1><p className="text-slate-600">Revisión manual de pagos, facturas y depósito bancario.</p></div><ReconciliationPanel /></main>;
}
