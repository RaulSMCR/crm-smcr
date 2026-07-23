import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import { createVersion } from "@/lib/carousel-versioning";
import { normalizeCurrentSlides } from "@/lib/editorial-import";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// La generación de 9 slides tarda ~5-15s; damos margen a la route Node.
export const maxDuration = 60;

function selfOrigin(req) {
  try {
    return new URL(req.url).origin;
  } catch {
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
  }
}

export async function POST(req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id } = await params;

  const secret = process.env.SLIDES_INTERNAL_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "SLIDES_INTERNAL_SECRET no está configurado en el entorno." },
      { status: 500 }
    );
  }

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const currentSlides = normalizeCurrentSlides(carousel.spec, carousel.assets);
  let selection = null;
  if (Array.isArray(body.indices)) {
    selection = body.indices.filter((value) => Number.isInteger(value) && value >= 0 && value < currentSlides.length);
  } else if (Array.isArray(body.slideIds)) {
    const wanted = new Set(body.slideIds.map(String));
    selection = currentSlides.map((slide, index) => wanted.has(slide.slideId) ? index : null).filter((index) => index !== null);
  }
  const renderKey = randomUUID();
  const origin = selfOrigin(req);
  let pyRes, pyBody;
  try {
    pyRes = await fetch(`${origin}/api/slides/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ slug: carousel.slug, spec: { ...carousel.spec, slides: currentSlides }, selection, renderKey }),
    });
    pyBody = await pyRes.json().catch(() => ({}));
  } catch (err) {
    return NextResponse.json(
      { message: "No se pudo contactar la función de render", detail: String(err) },
      { status: 502 }
    );
  }

  if (!pyRes.ok) {
    return NextResponse.json(
      { message: "La generación de slides falló", status: pyRes.status, detail: pyBody },
      { status: 502 }
    );
  }

  const assets = Array.isArray(pyBody.assets) ? pyBody.assets : [];
  if (assets.length === 0) {
    return NextResponse.json({ message: "La función no devolvió assets" }, { status: 502 });
  }

  const renderedByIndex = new Map(assets.map((asset) => [asset.index, asset]));
  const mergedAssets = carousel.assets.map((asset) => ({
    slideId: currentSlides[asset.index]?.slideId || `slide-${asset.id}`,
    index: asset.index,
    filename: asset.filename,
    storagePath: asset.storagePath,
    mimeType: "image/png",
    width: asset.width,
    height: asset.height,
    note: asset.note,
  }));
  for (const rendered of renderedByIndex.values()) {
    const slide = currentSlides[rendered.index];
    const replacement = {
      slideId: slide?.slideId || `slide-${rendered.index + 1}`,
      index: rendered.index,
      filename: rendered.filename,
      storagePath: rendered.storagePath,
      mimeType: "image/png",
      width: rendered.width ?? 1080,
      height: rendered.height ?? 1080,
    };
    const existing = mergedAssets.findIndex((asset) => asset.index === rendered.index);
    if (existing === -1) mergedAssets.push(replacement);
    else mergedAssets[existing] = replacement;
  }
  mergedAssets.sort((a, b) => a.index - b.index);

  const version = await prisma.$transaction(async (tx) => {
    const created = await createVersion(tx, {
      carouselId: id,
      baseVersionId: carousel.activeVersionId || null,
      spec: { ...carousel.spec, slides: currentSlides },
      createdBy: actor.userId,
      comment: selection === null ? "Renderizado completo" : "Renderizado selectivo",
      source: "RENDER",
      assets: mergedAssets,
    });
    await tx.carousel.update({
      where: { id },
      data: { spec: { ...carousel.spec, slides: currentSlides }, activeVersionId: created.id, status: "GENERATED" },
    });
    await tx.carouselAsset.deleteMany({ where: { carouselId: id } });
    if (mergedAssets.length) {
      await tx.carouselAsset.createMany({
        data: mergedAssets.map((asset) => ({
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

  return NextResponse.json({ ok: true, status: "GENERATED", count: assets.length, versionId: version.id, versionNumber: version.number });
}
