import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import NewCarouselForm from "@/components/admin/NewCarouselForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewCarouselPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/panel/admin/carousels" className="text-sm text-neutral-500 hover:text-neutral-700">
            Carruseles
          </Link>
          <h1 className="mt-1 text-3xl font-bold text-brand-900">Nuevo carrusel</h1>
          <p className="text-sm text-neutral-700">
            Pega o edita la spec JSON. La guía editorial vive en{" "}
            <span className="font-mono text-xs">vendor/instagram-slides/SKILL.md</span>. Podrás generar
            las slides y revisarlas antes de aprobar.
          </p>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <NewCarouselForm />
        </section>
      </div>
    </div>
  );
}
