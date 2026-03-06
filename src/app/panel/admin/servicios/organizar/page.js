import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import ServiceOrderManager from "@/components/admin/ServiceOrderManager";

export const dynamic = "force-dynamic";

export default async function AdminServiceOrderPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const services = await prisma.service.findMany({
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      displayOrder: true,
      isActive: true,
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <div className="text-sm text-slate-600">
          <Link href="/panel/admin/servicios" className="hover:underline">
            ← Volver a servicios
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Organizar orden de servicios</h1>
        <p className="mt-2 text-slate-600">
          Ajusta el orden de presentación en una sola tabla, con todos los servicios visibles.
        </p>
      </div>

      <ServiceOrderManager services={services} />
    </div>
  );
}
