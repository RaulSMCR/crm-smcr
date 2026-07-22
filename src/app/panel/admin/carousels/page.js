import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
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

export default async function AdminCarouselsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const carousels = await prisma.carousel.findMany({
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
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/panel/admin/marketing" className="text-sm text-neutral-500 hover:text-neutral-700">
              Gestión publicitaria
            </Link>
            <h1 className="mt-1 text-3xl font-bold text-brand-900">Carruseles</h1>
            <p className="text-sm text-neutral-700">
              Genera slides 1080×1080 con la paleta de marca a partir de una spec editorial.
            </p>
          </div>
          <Link
            href="/panel/admin/carousels/new"
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Nuevo carrusel
          </Link>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-[0.12em] text-neutral-500">
                <tr>
                  <th className="py-3 pr-4">Título</th>
                  <th className="py-3 pr-4">Estado</th>
                  <th className="py-3 pr-4 text-right">Slides</th>
                  <th className="py-3 pr-4">Actualizado</th>
                  <th className="py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {carousels.map((c) => (
                  <tr key={c.id}>
                    <td className="max-w-[360px] py-3 pr-4">
                      <Link href={`/panel/admin/carousels/${c.id}`} className="font-semibold text-brand-900 hover:text-brand-700">
                        {c.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-neutral-500">{c.slug}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <CarouselStatusBadge status={c.status} />
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-neutral-800">{c._count.assets}</td>
                    <td className="py-3 pr-4 text-neutral-600">{formatDate(c.updatedAt)}</td>
                    <td className="py-3 text-right">
                      <Link href={`/panel/admin/carousels/${c.id}`} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
                {carousels.length === 0 ? (
                  <tr>
                    <td className="py-6 text-sm text-neutral-600" colSpan={5}>
                      Todavía no hay carruseles. Crea el primero con “Nuevo carrusel”.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
