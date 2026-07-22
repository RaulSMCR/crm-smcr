import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getSignedUrl } from "@/lib/storage";
import { carouselSpecSchema, formatZodIssues } from "@/lib/carousel-spec";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAROUSELS_BUCKET = "carousels";
const SIGNED_URL_TTL = 3600; // 1h

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { res: NextResponse.json({ message: "No autorizado" }, { status: 401 }) };
  if (session.role !== "ADMIN") return { res: NextResponse.json({ message: "Acción no permitida" }, { status: 403 }) };
  return { session };
}

export async function GET(_req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    include: { assets: { orderBy: { index: "asc" } } },
  });
  if (!carousel) return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });

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
    createdAt: carousel.createdAt,
    updatedAt: carousel.updatedAt,
    assets,
  });
}

export async function PATCH(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({ where: { id }, select: { id: true } });
  if (!carousel) return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const data = {};

  // Editar la spec vuelve el carrusel a DRAFT (los assets previos quedan obsoletos).
  if (body.spec !== undefined) {
    const parsed = carouselSpecSchema.safeParse(body.spec);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Spec inválida", errors: formatZodIssues(parsed.error.issues) },
        { status: 422 }
      );
    }
    data.spec = parsed.data;
    data.status = "DRAFT";
  }

  // Cambios de estado permitidos por el flujo editorial.
  if (body.status !== undefined) {
    const allowed = ["DRAFT", "APPROVED", "PUBLISHED"];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { message: `status inválido (permitidos: ${allowed.join(", ")})` },
        { status: 422 }
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
