import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import TopicHubCreateForm from "@/components/admin/TopicHubCreateForm";

export const dynamic = "force-dynamic";

export default async function NewHubPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/panel/admin/hubs" className="text-sm font-semibold text-slate-600 hover:underline">← Administración de hubs</Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Crear hub</h1>
          <p className="mt-1 text-slate-600">Creá la identidad inicial y luego agregá módulos, contenido y funciones desde el editor.</p>
        </div>
        <TopicHubCreateForm />
      </div>
    </main>
  );
}
