import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import NewCarouselForm from "@/components/admin/NewCarouselForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewCarouselPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const professionals = await prisma.professionalProfile.findMany({
    where: { isApproved: true, user: { is: { isActive: true } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, specialty: true, user: { select: { name: true } } },
    take: 300,
  });
  const authorOptions = professionals.map((p) => ({
    id: p.id,
    name: p.user?.name || "Profesional",
    specialty: p.specialty || "",
  }));

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/panel/admin/carousels" className="text-sm text-neutral-500 hover:text-neutral-700">
            Carruseles
          </Link>
          <h1 className="mt-1 text-3xl font-bold text-brand-900">Nuevo carrusel</h1>
          <p className="text-sm text-neutral-700">
            Pega o edita la spec JSON, o pártelo desde un artículo. Elige el profesional al que se
            atribuye. Podrás generar las slides y revisarlas antes de aprobar.
          </p>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <NewCarouselForm isAdmin authorOptions={authorOptions} basePath="/panel/admin/carousels" />
        </section>
      </div>
    </div>
  );
}
