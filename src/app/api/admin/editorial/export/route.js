import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor, canAccessCarousel } from "@/lib/carousel-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildZip } from "@/lib/zip";
import { buildEditorialPackage, stripHtmlToText } from "@/lib/editorial-package";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAROUSELS_BUCKET = "carousels";

export async function POST(req) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const articleId = String(body?.articleId || "").trim();
  const carouselId = String(body?.carouselId || "").trim();
  if (!articleId) {
    return NextResponse.json({ message: "articleId es obligatorio" }, { status: 422 });
  }

  const article = await prisma.post.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      excerpt: true,
      coverImage: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!article || (!actor.isAdmin && article.authorId !== actor.profileId)) {
    return NextResponse.json({ message: "Artículo no encontrado" }, { status: 404 });
  }

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

  const assets = carousel?.assets || [];
  const packageData = buildEditorialPackage({ article, carousel, assets });
  const files = [...packageData.files];

  if (assets.length) {
    const supabase = getSupabaseAdmin();
    for (const asset of assets) {
      const { data, error } = await supabase.storage.from(CAROUSELS_BUCKET).download(asset.storagePath);
      if (error || !data) {
        return NextResponse.json(
          { message: `No se pudo descargar ${asset.filename} de Storage.` },
          { status: 502 }
        );
      }
      files.push({
        name: `assets/${asset.filename}`,
        data: Buffer.from(await data.arrayBuffer()),
      });
    }
  }

  const zip = buildZip(files);
  const slug = carousel?.slug || article.slug || article.id;
  return new NextResponse(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-editorial-package.zip"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
      "X-Editorial-Article-Text-Length": String(stripHtmlToText(article.content).length),
    },
  });
}
