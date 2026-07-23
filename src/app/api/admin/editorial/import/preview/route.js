import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import {
  applyImportToSlides,
  compareSlides,
  filesForSlides,
  inspectImportFiles,
  normalizeCurrentSlides,
  normalizeImportedPackage,
} from "@/lib/editorial-import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  if (!jsonFile || typeof jsonFile === "string" || typeof jsonFile.text !== "function") {
    return NextResponse.json({ message: "Adjunta un archivo carousel.json." }, { status: 422 });
  }

  let raw;
  try {
    raw = JSON.parse(await jsonFile.text());
  } catch (error) {
    return NextResponse.json({ message: "carousel.json no contiene JSON válido.", detail: String(error.message || error) }, { status: 422 });
  }

  const imported = normalizeImportedPackage(raw);
  if (!imported.ok) {
    return NextResponse.json({ message: "Paquete inválido.", errors: imported.errors }, { status: 422 });
  }

  const carouselId = String(form.get("carouselId") || imported.data.carousel?.id || "").trim();
  let carousel = null;
  if (carouselId) {
    carousel = await prisma.carousel.findUnique({
      where: { id: carouselId },
      include: { assets: { orderBy: { index: "asc" } } },
    });
    if (!carousel || !canAccessCarousel(actor, carousel)) {
      return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
    }
  }

  const currentSlides = normalizeCurrentSlides(carousel?.spec, carousel?.assets || []);
  const importedSlides = applyImportToSlides(currentSlides, imported.data);
  const fileValues = [];
  for (const value of form.values()) {
    if (value && typeof value !== "string" && typeof value.arrayBuffer === "function" && value.name !== "carousel.json") {
      fileValues.push(value);
    }
  }
  const files = await inspectImportFiles(fileValues);
  const slideFiles = filesForSlides(importedSlides, files.files);

  return NextResponse.json({
    ok: true,
    writesPerformed: false,
    carouselId: carousel?.id || null,
    base: {
      versionId: imported.data.carousel?.baseVersionId || null,
      currentUpdatedAt: carousel?.updatedAt || null,
    },
    imported: {
      mode: imported.data.mode,
      title: imported.data.carousel?.title || null,
      slideCount: importedSlides.length,
    },
    diff: compareSlides(currentSlides, importedSlides),
    files,
    slideFiles,
    confirmationRequired: true,
  });
}
