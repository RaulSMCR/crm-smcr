import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req, { params }) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;
  const { id, assetId } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    select: { id: true, createdBy: true },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  const asset = await prisma.carouselAsset.findUnique({
    where: { id: assetId },
    select: { id: true, carouselId: true },
  });
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

  const updated = await prisma.carouselAsset.update({
    where: { id: assetId },
    data,
    select: { id: true, ready: true, note: true },
  });

  return NextResponse.json(updated);
}
