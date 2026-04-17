import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminMarketingPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  return (
    <div className="min-h-screen bg-appbg p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link href="/panel/admin" className="text-sm text-neutral-500 hover:text-neutral-700">
            Panel
          </Link>
          <h1 className="text-3xl font-bold text-brand-900">Marketing</h1>
          <p className="text-sm text-neutral-700">Controles y manuales de campañas de mercadeo.</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-10 text-center">
          <p className="text-neutral-500">Este módulo está en construcción. Próximamente se agregarán campañas y manuales.</p>
        </div>
      </div>
    </div>
  );
}
