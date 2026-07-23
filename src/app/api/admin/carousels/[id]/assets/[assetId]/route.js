import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import { createVersion } from "@/lib/carousel-versioning";
import { normalizeCurrentSlides } from "@/lib/editorial-import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id, assetId } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  const asset = carousel.assets.find((item) => item.id === assetId);
  if (!asset || asset.carouselId !== id) {
    return NextResponse.json({ message: "Slide no encontrada" }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const data = {};
  if (body.ready !== undefined) data.ready = Boolean(body.ready);
  if (body.note !== undefined) data.note = body.note == null ? null : String(body.note);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "Nada para actualizar" }, { status: 400 });
  }

  const slides = normalizeCurrentSlides(carousel.spec, carousel.assets);
  const target = slides[asset.index];
  if (body.ready !== undefined && target) {
    target.approvalStatus = body.ready ? "APPROVED" : "DRAFT";
  }
  const versionAssets = carousel.assets.map((item) => {
    const slide = slides[item.index];
    return slide ? {
      slideId: slide.slideId,
      index: item.index,
      filename: item.filename,
      storagePath: item.storagePath,
      mimeType: "image/png",
      note: item.id === assetId && body.note !== undefined ? data.note : item.note,
      width: item.width,
      height: item.height,
    } : null;
  }).filter(Boolean);

  const version = await prisma.$transaction(async (tx) => {
    const created = await createVersion(tx, {
      carouselId: id,
      baseVersionId: carousel.activeVersionId || null,
      spec: { ...carousel.spec, slides },
      createdBy: actor.userId,
      comment: "Revisión individual de slide",
      source: "MANUAL_REVIEW",
      assets: versionAssets,
      approvalEvents: body.ready !== undefined && target
        ? [{ slideId: target.slideId, status: target.approvalStatus, comment: data.note }]
        : [],
    });
    await tx.carousel.update({
      where: { id },
      data: { spec: { ...carousel.spec, slides }, activeVersionId: created.id },
    });
    const updated = await tx.carouselAsset.update({
      where: { id: assetId },
      data,
      select: { id: true, ready: true, note: true },
    });
    return { version: created, asset: updated };
  });

  return NextResponse.json({ ...version.asset, version: { id: version.version.id, number: version.version.number } });
}
