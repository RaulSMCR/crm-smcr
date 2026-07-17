// src/app/api/mi/biblioteca/route.js
// Biblioteca del paciente: historial de lectura + artículos recomendados.
//
// Nota (AUDIT-PWA · RIESGOS-6): PostViewEvent.userId hoy solo se rellena en el
// registro (match por anon_id), no en el login. El historial por userId puede
// venir vacío para pacientes que ya tenían cuenta; vincular userId también en el
// login queda como mejora pendiente.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/mi/api-session";

export const dynamic = "force-dynamic";

const HISTORIAL_LIMIT = 30;
const RECOMENDADOS_LIMIT = 6;

function postDTO(post) {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? null,
    coverImage: post.coverImage ?? null,
    autor: post.author?.user?.name ?? null,
  };
}

export async function GET(request) {
  const auth = await requirePatientSession(request);
  if (auth instanceof NextResponse) return auth;

  const patientId = String(auth.session.userId || auth.session.sub);

  try {
    const historialRaw = await prisma.postViewEvent.findMany({
      where: { userId: patientId, post: { status: "PUBLISHED" } },
      orderBy: [{ readAt: "desc" }, { updatedAt: "desc" }],
      take: HISTORIAL_LIMIT,
      select: {
        id: true,
        isRead: true,
        readAt: true,
        updatedAt: true,
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            coverImage: true,
            author: { select: { user: { select: { name: true } } } },
          },
        },
      },
    });

    const historial = historialRaw.map((e) => ({
      eventId: e.id,
      isRead: e.isRead,
      readAt: e.readAt,
      updatedAt: e.updatedAt,
      post: postDTO(e.post),
    }));

    const leidosIds = historialRaw.map((e) => e.post.id);

    const recomendadosRaw = await prisma.post.findMany({
      where: { status: "PUBLISHED", id: { notIn: leidosIds.length ? leidosIds : ["__none__"] } },
      orderBy: { createdAt: "desc" },
      take: RECOMENDADOS_LIMIT,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        author: { select: { user: { select: { name: true } } } },
      },
    });

    return NextResponse.json({
      historial,
      recomendados: recomendadosRaw.map(postDTO),
    });
  } catch (error) {
    console.error("[/api/mi/biblioteca] error:", error);
    return NextResponse.json({ error: "No se pudo cargar la biblioteca." }, { status: 500 });
  }
}
