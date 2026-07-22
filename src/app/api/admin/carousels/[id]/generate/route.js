import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";

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
    select: { id: true, slug: true, spec: true, createdBy: true },
  });
  if (!carousel || !canAccessCarousel(actor, carousel)) {
    return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });
  }

  const origin = selfOrigin(req);
  let pyRes, pyBody;
  try {
    pyRes = await fetch(`${origin}/api/slides/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ slug: carousel.slug, spec: carousel.spec }),
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

  await prisma.$transaction([
    prisma.carouselAsset.deleteMany({ where: { carouselId: id } }),
    prisma.carouselAsset.createMany({
      data: assets.map((a) => ({
        carouselId: id,
        index: a.index,
        filename: a.filename,
        storagePath: a.storagePath,
        width: a.width ?? 1080,
        height: a.height ?? 1080,
      })),
    }),
    prisma.carousel.update({ where: { id }, data: { status: "GENERATED" } }),
  ]);

  return NextResponse.json({ ok: true, status: "GENERATED", count: assets.length });
}
