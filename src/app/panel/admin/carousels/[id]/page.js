import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/storage";
import CarouselStatusBadge from "@/components/admin/CarouselStatusBadge";
import CarouselEditor from "@/components/admin/CarouselEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAROUSELS_BUCKET = "carousels";

export default async function CarouselDetailPage({ params }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!carousel) notFound();

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
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/panel/admin/carousels" className="text-sm text-neutral-500 hover:text-neutral-700">
              Carruseles
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-brand-900">{carousel.title}</h1>
              <CarouselStatusBadge status={carousel.status} />
            </div>
            <p className="mt-1 font-mono text-xs text-neutral-500">{carousel.slug}</p>
          </div>
        </div>

        <CarouselEditor carousel={editorData} />
      </div>
    </div>
  );
}
