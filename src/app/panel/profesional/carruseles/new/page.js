import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import NewCarouselForm from "@/components/admin/NewCarouselForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfesionalNuevoCarruselPage() {
  const session = await getSession();
  if (!session?.sub) redirect("/ingresar");
  if (session.role !== "PROFESSIONAL") redirect("/");

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/panel/profesional/carruseles" className="text-sm text-slate-500 hover:text-slate-700">
          Mis carruseles
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-slate-800">Nuevo carrusel</h1>
        <p className="text-sm text-slate-500">
          Pega o edita la spec JSON, o pártelo desde uno de tus artículos. Genera las slides y quedarán
          listas para que un administrador las revise y coloque en Instagram.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <NewCarouselForm basePath="/panel/profesional/carruseles" />
      </section>
    </div>
  );
}
