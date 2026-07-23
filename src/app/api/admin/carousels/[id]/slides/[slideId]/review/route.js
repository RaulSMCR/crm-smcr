import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import { createVersion } from "@/lib/carousel-versioning";
import { normalizeCurrentSlides } from "@/lib/editorial-import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED = new Set(["DRAFT", "APPROVED", "REJECTED"]);

export async function POST(req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id, slideId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }
  const status = String(body?.status || "").toUpperCase();
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ message: "Estado de slide inválido" }, { status: 422 });
  }

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  const slides = normalizeCurrentSlides(carousel.spec, carousel.assets);
  const target = slides.find((slide) => slide.slideId === slideId);
  if (!target) return NextResponse.json({ message: "Slide no encontrada" }, { status: 404 });
  target.approvalStatus = status;

  const versionAssets = carousel.assets.map((asset) => {
    const slide = slides[asset.index];
    return slide ? {
      slideId: slide.slideId,
      index: asset.index,
      filename: asset.filename,
      storagePath: asset.storagePath,
      mimeType: "image/png",
      width: asset.width,
      height: asset.height,
      note: asset.note,
    } : null;
  }).filter(Boolean);

  const result = await prisma.$transaction(async (tx) => {
    const version = await createVersion(tx, {
      carouselId: id,
      baseVersionId: carousel.activeVersionId || null,
      spec: { ...carousel.spec, slides },
      createdBy: actor.userId,
      comment: String(body.comment || `Slide ${slideId}: ${status}`),
      source: "MANUAL_REVIEW",
      assets: versionAssets,
      approvalEvents: [{ slideId, status, comment: body.comment }],
    });
    await tx.carousel.update({
      where: { id },
      data: { spec: { ...carousel.spec, slides }, activeVersionId: version.id },
    });
    const asset = carousel.assets.find((item) => item.index === target.position - 1);
    if (asset) {
      await tx.carouselAsset.update({
        where: { id: asset.id },
        data: { ready: status === "APPROVED" },
      });
    }
    return version;
  });

  return NextResponse.json({
    ok: true,
    slideId,
    status,
    version: { id: result.id, number: result.number, createdAt: result.createdAt },
  });
}
