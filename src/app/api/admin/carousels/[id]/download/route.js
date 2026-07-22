import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildZip } from "@/lib/zip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAROUSELS_BUCKET = "carousels";

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
  if (carousel.assets.length === 0) {
    return NextResponse.json({ message: "El carrusel no tiene slides generadas." }, { status: 409 });
  }

  const supabase = getSupabaseAdmin();
  const files = [];
  for (const asset of carousel.assets) {
    const { data, error } = await supabase.storage.from(CAROUSELS_BUCKET).download(asset.storagePath);
    if (error || !data) {
      return NextResponse.json(
        { message: `No se pudo descargar ${asset.filename} de Storage.`, detail: String(error?.message || "") },
        { status: 502 }
      );
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    files.push({ name: asset.filename, data: buffer });
  }

  const zip = buildZip(files);
  return new NextResponse(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${carousel.slug}.zip"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
    },
  });
}
