// src/app/panel/admin/blog/taxonomia/page.js
//
// Esta pantalla crea el vocabulario de la biblioteca; no lo aplica. Aplicarlo
// se hace en cada artículo. Esa separación —dos pasos en dos pantallas— no se
// deducía de nada de lo que había acá, y es la primera causa de que la pantalla
// no se entienda: se crea una serie, no pasa nada en el sitio, y no hay forma
// de saber qué falta.
//
// Por eso ahora la página trae, además del vocabulario, el estado real de cada
// término: qué se ve en el sitio, qué está a medias y qué artículos cuelgan de
// cada serie, con el enlace para ir a terminar el trabajo.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import TaxonomyManager from "@/components/admin/TaxonomyManager";
import VocabularioParaMatriz from "@/components/admin/VocabularioParaMatriz";

export const dynamic = "force-dynamic";

// El artículo aparece bajo una disciplina o un tema cuando la etiqueta está
// aprobada y el artículo publicado. Es el mismo criterio que usa `/blog`.
const etiquetaCuenta = (fila) => fila.status === "APPROVED" && fila.post?.status === "PUBLISHED";

export default async function TaxonomyAdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  // Secuencial: pool de una sola conexión (connection_limit=1); en paralelo
  // se pisan y expiran (P2024).
  //
  // Se traen las filas de unión en vez de `_count` porque hacen falta dos
  // números por término —cuántas etiquetas hay y cuántas se ven— y `_count` da
  // uno solo. Son pocas filas y la pantalla es de uso interno.
  const disciplinesRows = await prisma.discipline.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, slug: true, isActive: true,
      posts: { select: { status: true, post: { select: { status: true } } } },
    },
  });
  const topicsRows = await prisma.topic.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, slug: true, isActive: true, status: true,
      posts: { select: { status: true, post: { select: { status: true, noindex: true } } } },
    },
  });
  const phases = await prisma.phase.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, isActive: true, _count: { select: { series: true } } },
  });
  const seriesRows = await prisma.series.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, slug: true, isActive: true, description: true, phaseId: true,
      posts: {
        orderBy: [{ seriesOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, status: true, seriesApproved: true, seriesOrder: true },
      },
    },
  });
  const complements = await prisma.topicComplement.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      from: { select: { id: true, name: true } },
      to: { select: { id: true, name: true } },
    },
  });

  const disciplines = disciplinesRows.map(({ posts, ...d }) => ({
    ...d,
    total: posts.length,
    visibles: posts.filter(etiquetaCuenta).length,
  }));

  // El tema suma una condición más que la disciplina: su página de archivo
  // excluye los artículos marcados `noindex`, así que uno noindex no la
  // sostiene. Si no se contara, un tema con un solo artículo oculto se
  // anunciaría como visible y su URL daría 404.
  const topics = topicsRows.map(({ posts, ...t }) => ({
    ...t,
    total: posts.length,
    visibles: posts.filter((fila) => etiquetaCuenta(fila) && fila.post?.noindex !== true).length,
  }));

  const series = seriesRows.map(({ posts, ...s }) => ({ ...s, entregas: posts }));

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/panel/admin/blog" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
            ← Gestión editorial
          </Link>
          <h1 className="mt-1 text-3xl font-bold text-slate-800">Series y etiquetas de la biblioteca</h1>
          <p className="mt-1 text-slate-600">
            Acá se crean los nombres con los que se ordenan los artículos. Aplicarlos a un artículo
            se hace en el artículo.
          </p>
        </div>

        <section className="rounded-xl border border-brand-200 bg-brand-50/50 p-5">
          <h2 className="text-sm font-bold text-slate-900">Cómo se usa esta pantalla</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">1</span>
              <span>
                <strong>Acá, una sola vez:</strong> se crea la serie o la etiqueta. Crearla no cambia
                nada en el sitio todavía — es solo el nombre.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">2</span>
              <span>
                <strong>En cada artículo:</strong> se abre el artículo desde{" "}
                <Link href="/panel/admin/blog" className="font-semibold text-brand-700 underline">Gestión editorial</Link>{" "}
                y en el recuadro <em>«Orden de lectura por series»</em> se elige la serie y el número de parte.
                Recién ahí el artículo entra.
              </span>
            </li>
          </ol>
          <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
            <p>
              Debajo de cada serie vas a ver qué artículos tiene y cuáles faltan, con el enlace
              directo para ir a asignarlos.
            </p>
            {/* Antes cada campo se guardaba al salir del foco, sin confirmar
                nada. Ahora las ediciones se juntan y se guardan de una vez. */}
            <p>
              <strong>Las ediciones no se guardan solas.</strong> Editá lo que necesites —nombres,
              descripciones, qué se muestra y qué no— y abajo va a aparecer una barra con cuántos
              cambios llevás y el botón <em>Guardar todos los cambios</em>. Al guardarlos vas a ver
              un informe de qué cambió. Crear y eliminar, en cambio, se aplican en el momento.
            </p>
          </div>
        </section>

        <TaxonomyManager
          disciplines={disciplines}
          topics={topics}
          phases={phases}
          series={series}
          complements={complements}
        />

        <VocabularioParaMatriz
          disciplines={disciplines}
          topics={topics}
          phases={phases}
          series={series}
        />
      </div>
    </main>
  );
}
