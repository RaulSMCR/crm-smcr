import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProfessionalHubOptions } from "@/lib/professional-hub-queries";
import ProfessionalHubEditor from "@/components/admin/ProfessionalHubEditor";

export const dynamic = "force-dynamic";

export default async function NewProfessionalHubPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  const profiles = await listProfessionalHubOptions();
  return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-6xl space-y-5"><Link href="/panel/admin/hubs" className="text-sm font-semibold text-slate-600 hover:underline">← Administración de hubs</Link><div><h1 className="text-3xl font-bold text-slate-950">Nuevo hub profesional</h1><p className="mt-1 text-slate-600">Creá la configuración pública de un profesional. Inicia como borrador.</p></div><ProfessionalHubEditor profiles={profiles} isNew /></div></main>;
}
