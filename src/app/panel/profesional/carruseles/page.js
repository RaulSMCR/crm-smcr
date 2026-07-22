import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import CarouselStatusBadge from "@/components/admin/CarouselStatusBadge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return "";
  }
}

export default async function ProfesionalCarruselesPage() {
  const session = await getSession();
  if (!session?.sub) redirect("/ingresar");
  if (session.role !== "PROFESSIONAL") redirect("/");

  const carousels = await prisma.carousel.findMany({
    where: { createdBy: String(session.sub) },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      updatedAt: true,
      _count: { select: { assets: true } },
    },
    take: 200,
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/panel/profesional" className="text-sm text-slate-500 hover:text-slate-700">
            Panel profesional
          </Link>
          <h1 className="mt-1 text-3xl font-bold text-slate-800">Mis carruseles</h1>
          <p className="text-sm text-slate-500">
            Crea carruseles para Instagram. Un administrador los revisa y los coloca en las redes.
          </p>
        </div>
        <Link
          href="/panel/profesional/carruseles/new"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Nuevo carrusel
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="p-4">Título</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Slides</th>
              <th className="p-4">Actualizado</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carousels.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-4">
                  <Link href={`/panel/profesional/carruseles/${c.id}`} className="font-semibold text-slate-800 hover:underline">
                    {c.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-500">{c.slug}</div>
                </td>
                <td className="p-4">
                  <CarouselStatusBadge status={c.status} />
                </td>
                <td className="p-4 text-right font-semibold text-slate-800">{c._count.assets}</td>
                <td className="p-4 text-slate-600">{formatDate(c.updatedAt)}</td>
                <td className="p-4 text-right">
                  <Link href={`/panel/profesional/carruseles/${c.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {carousels.length === 0 ? (
              <tr>
                <td className="p-6 text-slate-500" colSpan={5}>
                  Aún no tienes carruseles. Crea el primero con “Nuevo carrusel”.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
