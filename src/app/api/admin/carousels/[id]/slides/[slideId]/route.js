import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import { carouselSpecSchema, formatZodIssues } from "@/lib/carousel-spec";
import { createVersion } from "@/lib/carousel-versioning";
import { normalizeCurrentSlides } from "@/lib/editorial-import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TEXT_FIELDS = new Set([
  "tag", "title", "subtitle", "hook", "body", "items", "points", "quote", "author",
  "stat", "label", "description", "cta", "subcta", "handle", "visualBrief",
]);

export async function PATCH(req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id, slideId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }
  if (!body?.changes || typeof body.changes !== "object" || Array.isArray(body.changes)) {
    return NextResponse.json({ message: "changes debe ser un objeto" }, { status: 422 });
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
  for (const [key, value] of Object.entries(body.changes)) {
    if (TEXT_FIELDS.has(key)) target[key] = value;
  }

  const parsed = carouselSpecSchema.safeParse({ ...carousel.spec, slides });
  if (!parsed.success) {
    return NextResponse.json({ message: "Texto de slide inválido", errors: formatZodIssues(parsed.error.issues) }, { status: 422 });
  }
  const spec = { ...parsed.data, slides };
  const versionAssets = carousel.assets.map((asset) => {
    const slide = slides[asset.index];
    return slide ? {
      slideId: slide.slideId,
      index: asset.index,
      filename: asset.filename,
      storagePath: asset.storagePath,
      mimeType: "image/png",
      note: asset.note,
      width: asset.width,
      height: asset.height,
    } : null;
  }).filter(Boolean);

  const version = await prisma.$transaction(async (tx) => {
    const created = await createVersion(tx, {
      carouselId: id,
      baseVersionId: carousel.activeVersionId || null,
      spec,
      createdBy: actor.userId,
      comment: String(body.comment || `Edición de texto de ${slideId}`),
      source: "MANUAL_SLIDE_EDIT",
      assets: versionAssets,
    });
    await tx.carousel.update({ where: { id }, data: { spec, activeVersionId: created.id, status: "DRAFT" } });
    return created;
  });

  return NextResponse.json({ ok: true, slideId, version: { id: version.id, number: version.number, createdAt: version.createdAt } });
}
