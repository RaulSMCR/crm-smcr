import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import { getSignedUrl } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { carouselSpecSchema, formatZodIssues } from "@/lib/carousel-spec";
import { createVersion } from "@/lib/carousel-versioning";
import { normalizeCurrentSlides } from "@/lib/editorial-import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAROUSELS_BUCKET = "carousels";
const SIGNED_URL_TTL = 3600; // 1h

export async function GET(_req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  const assets = await Promise.all(
    carousel.assets.map(async (a) => {
      let url = null;
      try {
        url = await getSignedUrl(CAROUSELS_BUCKET, a.storagePath, SIGNED_URL_TTL);
      } catch {
        url = null;
      }
      return {
        id: a.id,
        index: a.index,
        filename: a.filename,
        storagePath: a.storagePath,
        width: a.width,
        height: a.height,
        url,
      };
    })
  );

  return NextResponse.json({
    id: carousel.id,
    slug: carousel.slug,
    title: carousel.title,
    status: carousel.status,
    spec: carousel.spec,
    articleUrl: carousel.articleUrl,
    authorId: carousel.authorId,
    createdAt: carousel.createdAt,
    updatedAt: carousel.updatedAt,
    assets,
  });
}

export async function PATCH(req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const data = {};

  // La spec se conserva como proyecciÃ³n de la nueva versiÃ³n; la versiÃ³n anterior no se modifica.
  if (body.spec !== undefined) {
    const parsed = carouselSpecSchema.safeParse(body.spec);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Spec inválida", errors: formatZodIssues(parsed.error.issues) },
        { status: 422 }
      );
    }
    const normalizedSpec = {
      ...parsed.data,
      slides: normalizeCurrentSlides(parsed.data, carousel.assets),
    };
    const versionAssets = carousel.assets.map((asset) => {
      const slide = normalizedSpec.slides[asset.index];
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
    const version = await prisma.$transaction(async (tx) => {
      const created = await createVersion(tx, {
        carouselId: id,
        baseVersionId: carousel.activeVersionId || null,
        spec: normalizedSpec,
        createdBy: actor.userId,
        comment: "EdiciÃ³n manual de la spec",
        source: "MANUAL_EDIT",
        assets: versionAssets,
      });
      await tx.carousel.update({
        where: { id },
        data: { spec: normalizedSpec, status: "DRAFT", activeVersionId: created.id },
      });
      return created;
    });
    return NextResponse.json({
      id,
      status: "DRAFT",
      version: { id: version.id, number: version.number, hash: version.specHash, createdAt: version.createdAt },
    });
  }

  // Estados: aprobar/publicar (colocar en redes) es exclusivo de admin.
  if (body.status !== undefined) {
    const allowed = ["DRAFT", "APPROVED", "PUBLISHED"];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { message: `status inválido (permitidos: ${allowed.join(", ")})` },
        { status: 422 }
      );
    }
    if ((body.status === "APPROVED" || body.status === "PUBLISHED") && !actor.isAdmin) {
      return NextResponse.json(
        { message: "Solo un administrador puede aprobar o publicar (colocar en redes)." },
        { status: 403 }
      );
    }
    data.status = body.status;
  }

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ message: "title inválido" }, { status: 422 });
    }
    data.title = body.title.trim();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "Nada para actualizar" }, { status: 400 });
  }

  const updated = await prisma.carousel.update({
    where: { id },
    data,
    select: { id: true, slug: true, title: true, status: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    select: { id: true, createdBy: true, assets: { select: { storagePath: true } } },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  // Limpieza best-effort de los PNG en Storage; no bloquea el borrado del registro.
  try {
    const paths = carousel.assets.map((a) => a.storagePath).filter(Boolean);
    if (paths.length) {
      await getSupabaseAdmin().storage.from(CAROUSELS_BUCKET).remove(paths);
    }
  } catch {
    // Los objetos huérfanos se pueden limpiar aparte; el registro debe borrarse igual.
  }

  await prisma.carousel.delete({ where: { id } }); // cascade borra los assets

  return NextResponse.json({ ok: true });
}
