import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor } from "@/lib/carousel-access";
import { createCarouselSchema, slugify, SLUG_RE, formatZodIssues } from "@/lib/carousel-spec";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const { actor, res } = await getCarouselActor();
  if (res) return res;

  // Admin ve todos; profesional solo los propios.
  const where = actor.isAdmin ? {} : { createdBy: actor.userId };

  const rows = await prisma.carousel.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { assets: true } },
    },
    take: 200,
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status,
      authorId: r.authorId,
      assetCount: r._count.assets,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  );
}

export async function POST(req) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const parsed = createCarouselSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Datos inválidos", errors: formatZodIssues(parsed.error.issues) },
      { status: 422 }
    );
  }

  const { title, spec } = parsed.data;
  const slug = parsed.data.slug || slugify(title);
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { message: "No se pudo derivar un slug válido del título; especifícalo manualmente." },
      { status: 422 }
    );
  }

  const exists = await prisma.carousel.findUnique({ where: { slug }, select: { id: true } });
  if (exists) {
    return NextResponse.json({ message: `El slug "${slug}" ya existe.` }, { status: 409 });
  }

  // Autor: el profesional que crea es el autor; el admin puede elegirlo (o dejarlo vacío).
  let authorId = null;
  if (actor.isAdmin) {
    const requested = String(body.authorId || "").trim();
    if (requested) {
      const prof = await prisma.professionalProfile.findUnique({ where: { id: requested }, select: { id: true } });
      if (!prof) return NextResponse.json({ message: "El autor seleccionado no existe." }, { status: 422 });
      authorId = requested;
    }
  } else {
    authorId = actor.profileId;
  }

  const sourceText = parsed.data.sourceText?.trim() || null;
  const sourcePostId = parsed.data.sourcePostId?.trim() || null;

  const carousel = await prisma.carousel.create({
    data: {
      title,
      slug,
      spec,
      status: "DRAFT",
      createdBy: actor.userId,
      authorId,
      sourceText,
      sourcePostId,
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  return NextResponse.json(carousel, { status: 201 });
}
