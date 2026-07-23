import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    select: { id: true, createdBy: true },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  const versions = await prisma.carouselVersion.findMany({
    where: { carouselId: id },
    orderBy: { number: "desc" },
    include: {
      _count: { select: { assets: true, approvalEvents: true } },
    },
  });

  return NextResponse.json({
    versions: versions.map((version) => ({
      id: version.id,
      number: version.number,
      hash: version.specHash,
      parentVersionId: version.parentVersionId,
      comment: version.comment,
      source: version.source,
      createdBy: version.createdBy,
      createdAt: version.createdAt,
      assetCount: version._count.assets,
      approvalEventCount: version._count.approvalEvents,
    })),
  });
}
