import crypto from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import { uploadPrivate, detectFileMimeType } from "@/lib/storage";
import { imageDimensions } from "@/lib/image-size";
import { createVersion } from "@/lib/carousel-versioning";
import {
  applyImportToSlides,
  normalizeCurrentSlides,
  normalizeImportedPackage,
} from "@/lib/editorial-import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "carousels";
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function safeFilename(value) {
  const filename = path.basename(String(value || "")).replace(/[^a-zA-Z0-9._-]/g, "-");
  return filename || "asset";
}

function extForMime(mime) {
  return mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
}

export async function POST(req) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: "Se esperaba multipart/form-data" }, { status: 400 });
  }

  const jsonFile = form.get("carousel.json");
  const carouselId = String(form.get("carouselId") || "").trim();
  if (!carouselId || !jsonFile || typeof jsonFile === "string" || typeof jsonFile.text !== "function") {
    return NextResponse.json({ message: "carouselId y carousel.json son obligatorios." }, { status: 422 });
  }

  let raw;
  try {
    raw = JSON.parse(await jsonFile.text());
  } catch {
    return NextResponse.json({ message: "carousel.json no contiene JSON válido." }, { status: 422 });
  }
  const imported = normalizeImportedPackage(raw);
  if (!imported.ok) {
    return NextResponse.json({ message: "Paquete inválido.", errors: imported.errors }, { status: 422 });
  }

  const carousel = await prisma.carousel.findUnique({
    where: { id: carouselId },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  const requestedBase = imported.data.carousel?.baseVersionId || null;
  if (requestedBase && carousel.activeVersionId && requestedBase !== carousel.activeVersionId) {
    return NextResponse.json(
      { message: "La versión base del paquete ya no es la versión activa.", code: "STALE_BASE_VERSION" },
      { status: 409 }
    );
  }

  const currentSlides = normalizeCurrentSlides(carousel.spec, carousel.assets);
  const slides = applyImportToSlides(currentSlides, imported.data);
  const files = [];
  for (const value of form.values()) {
    if (value && typeof value !== "string" && typeof value.arrayBuffer === "function" && value.name !== "carousel.json") {
      const buffer = Buffer.from(await value.arrayBuffer());
      const mime = detectFileMimeType(buffer);
      if (!ALLOWED.has(mime)) {
        return NextResponse.json({ message: `Formato no soportado: ${value.name}` }, { status: 422 });
      }
      const dimensions = imageDimensions(buffer);
      files.push({
        name: value.name,
        buffer,
        mime,
        width: dimensions?.width || 1080,
        height: dimensions?.height || 1080,
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      });
    }
  }
  const byName = new Map(files.map((file) => [file.name, file]));
  const uploadedAssets = [];
  const versionKey = crypto.randomUUID();

  for (const [index, slide] of slides.entries()) {
    const ref = slide.assetRefs?.[0];
    const filename = ref?.filename || path.basename(String(ref?.path || ""));
    const incoming = filename ? byName.get(filename) : null;
    if (incoming) {
      const finalName = `${versionKey}-${safeFilename(incoming.name)}`;
      const storagePath = `editorial/${carousel.id}/${versionKey}/${finalName}`;
      await uploadPrivate(BUCKET, storagePath, incoming.buffer, incoming.mime);
      uploadedAssets.push({
        slideId: slide.slideId,
        index,
        filename: incoming.name,
        storagePath,
        mimeType: incoming.mime,
        sha256: incoming.sha256,
        width: incoming.width,
        height: incoming.height,
      });
    } else {
      const legacy = carousel.assets.find((asset) => asset.index === index);
      if (legacy) {
        uploadedAssets.push({
          slideId: slide.slideId,
          index,
          filename: legacy.filename,
          storagePath: legacy.storagePath,
          mimeType: "image/png",
          sha256: null,
          width: legacy.width,
          height: legacy.height,
          note: legacy.note,
        });
      }
    }
  }

  const spec = {
    title: imported.data.carousel?.title || carousel.title,
    slides,
  };
  const version = await prisma.$transaction(async (tx) => {
    const created = await createVersion(tx, {
      carouselId: carousel.id,
      baseVersionId: carousel.activeVersionId || null,
      spec,
      createdBy: actor.userId,
      comment: String(form.get("comment") || "Importación manual"),
      assets: uploadedAssets,
    });

    await tx.carousel.update({
      where: { id: carousel.id },
      data: {
        title: spec.title,
        spec,
        activeVersionId: created.id,
        status: "DRAFT",
      },
    });

    await tx.carouselAsset.deleteMany({ where: { carouselId: carousel.id } });
    if (uploadedAssets.length) {
      await tx.carouselAsset.createMany({
        data: uploadedAssets.map((asset) => ({
          carouselId: carousel.id,
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
    carouselId: carousel.id,
    version: {
      id: version.id,
      number: version.number,
      hash: version.specHash,
      createdAt: version.createdAt,
    },
  });
}
