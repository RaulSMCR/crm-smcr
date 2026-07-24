// src/app/panel/admin/blog/taxonomia/page.js
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import TaxonomyManager from "@/components/admin/TaxonomyManager";

export const dynamic = "force-dynamic";

export default async function TaxonomyAdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  // Secuencial: pool de una sola conexión (connection_limit=1); en paralelo
  // se pisan y expiran (P2024).
  const disciplines = await prisma.discipline.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, isActive: true, _count: { select: { posts: true } } },
  });
  const topics = await prisma.topic.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, isActive: true, _count: { select: { posts: true } } },
  });
  const series = await prisma.series.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, isActive: true, description: true, _count: { select: { posts: true } } },
  });
  const complements = await prisma.topicComplement.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      from: { select: { id: true, name: true } },
      to: { select: { id: true, name: true } },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/panel/admin/blog" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
              ← Gestión editorial
            </Link>
            <h1 className="mt-1 text-3xl font-bold text-slate-800">Taxonomía de la biblioteca</h1>
            <p className="text-slate-500">Disciplinas, temas, series y temas complementarios.</p>
          </div>
        </div>

        <TaxonomyManager
          disciplines={disciplines}
          topics={topics}
          series={series}
          complements={complements}
        />
      </div>
    </main>
  );
}
