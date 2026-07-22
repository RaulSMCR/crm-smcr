import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/storage";
import CarouselStatusBadge from "@/components/admin/CarouselStatusBadge";
import CarouselEditor from "@/components/admin/CarouselEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAROUSELS_BUCKET = "carousels";

export default async function ProfesionalCarruselDetallePage({ params }) {
  const session = await getSession();
  if (!session?.sub) redirect("/ingresar");
  if (session.role !== "PROFESSIONAL") redirect("/");

  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  // Un profesional solo ve sus propios carruseles.
  if (!carousel || carousel.createdBy !== String(session.sub)) notFound();

  const assets = await Promise.all(
    carousel.assets.map(async (a) => {
      let url = null;
      try {
        url = await getSignedUrl(CAROUSELS_BUCKET, a.storagePath, 3600);
      } catch {
        url = null;
      }
      return {
        id: a.id,
        index: a.index,
        filename: a.filename,
        width: a.width,
        height: a.height,
        ready: a.ready,
        note: a.note || "",
        url,
      };
    })
  );

  const editorData = {
    id: carousel.id,
    slug: carousel.slug,
    title: carousel.title,
    status: carousel.status,
    spec: carousel.spec,
    assets,
    hasSource: Boolean(carousel.sourceText && carousel.sourceText.trim()),
    sourcePostId: carousel.sourcePostId || null,
    blogPostId: carousel.blogPostId || null,
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <Link href="/panel/profesional/carruseles" className="text-sm text-slate-500 hover:text-slate-700">
          Mis carruseles
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-800">{carousel.title}</h1>
          <CarouselStatusBadge status={carousel.status} />
        </div>
        <p className="mt-1 font-mono text-xs text-slate-500">{carousel.slug}</p>
        {carousel.status === "GENERATED" ? (
          <p className="mt-2 text-sm text-slate-600">
            Slides generadas. Un administrador las revisará y las colocará en las redes.
          </p>
        ) : null}
      </div>

      <CarouselEditor carousel={editorData} canApprove={false} />
    </div>
  );
}
