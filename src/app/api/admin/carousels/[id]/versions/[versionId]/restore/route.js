import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import { createVersion } from "@/lib/carousel-versioning";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id, versionId } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  const target = await prisma.carouselVersion.findFirst({
    where: { id: versionId, carouselId: id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!target) return NextResponse.json({ message: "Versión no encontrada" }, { status: 404 });

  const version = await prisma.$transaction(async (tx) => {
    const created = await createVersion(tx, {
      carouselId: id,
      baseVersionId: carousel.activeVersionId || null,
      spec: target.spec,
      createdBy: actor.userId,
      comment: `Restauración de la versión ${target.number}`,
      source: "RESTORE",
      assets: target.assets,
    });
    await tx.carousel.update({
      where: { id },
      data: {
        title: target.spec?.title || carousel.title,
        spec: target.spec,
        activeVersionId: created.id,
        status: "DRAFT",
      },
    });
    await tx.carouselAsset.deleteMany({ where: { carouselId: id } });
    if (target.assets.length) {
      await tx.carouselAsset.createMany({
        data: target.assets.map((asset) => ({
          carouselId: id,
          index: asset.index,
          filename: asset.filename,
          storagePath: asset.storagePath,
          width: asset.width,
          height: asset.height,
          ready: false,
          note: asset.note || null,
        })),
      });
    }
    return created;
  });

  return NextResponse.json({
    ok: true,
    carouselId: id,
    restoredFrom: versionId,
    version: { id: version.id, number: version.number, createdAt: version.createdAt },
  });
}
