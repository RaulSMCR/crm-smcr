import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createCarouselSchema, slugify, SLUG_RE, formatZodIssues } from "@/lib/carousel-spec";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { res: NextResponse.json({ message: "No autorizado" }, { status: 401 }) };
  if (session.role !== "ADMIN") return { res: NextResponse.json({ message: "Acción no permitida" }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const { session, res } = await requireAdmin();
  if (res) return res;

  const rows = await prisma.carousel.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
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
      assetCount: r._count.assets,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  );
}

export async function POST(req) {
  const { session, res } = await requireAdmin();
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

  const carousel = await prisma.carousel.create({
    data: {
      title,
      slug,
      spec,
      status: "DRAFT",
      createdBy: String(session.sub || session.userId || ""),
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  return NextResponse.json(carousel, { status: 201 });
}
