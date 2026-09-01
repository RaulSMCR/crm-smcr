// src/app/api/profesionales/[slug]/ficha/route.js
//
// Datos de la ficha ampliada que se abre al pulsar la foto de un profesional.
//
// Existe como endpoint y no como parte de la consulta de cada página porque la
// mayoría de las visitas no abre ninguna ficha. Traer la reseña completa y los
// artículos de cinco profesionales en cada render de la home costaría dos
// consultas más por visita para algo que casi nadie mira; acá se pagan solo
// cuando alguien efectivamente abre la ventana.
//
// Todo lo que devuelve ya es público: la reseña APROBADA (nunca el borrador) y
// títulos de artículos publicados. No expone correo, teléfono, cédula ni nada
// del expediente, así que no pide sesión.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

const MAX_PUBLICACIONES = 4;

export async function GET(_request, { params }) {
  try {
    const slug = String((await params)?.slug || "").trim();
    if (!slug) {
      return NextResponse.json({ error: "Slug requerido." }, { status: 400 });
    }

    const professional = await prisma.professionalProfile.findFirst({
      where: { slug, isApproved: true, user: { is: { isActive: true } } },
      select: {
        id: true,
        slug: true,
        specialty: true,
        licenseNumber: true,
        // `profileReview` y no `profileReviewDraft`: el borrador es lo que el
        // profesional mandó a revisión y el admin todavía no aprobó. Publicarlo
        // acá saltearía el visado.
        profileReview: true,
        user: { select: { name: true, image: true } },
        serviceAssignments: {
          where: { status: "APPROVED", service: { is: { isActive: true } } },
          select: { service: { select: { id: true, title: true, slug: true } } },
          take: 6,
        },
      },
    });

    if (!professional) {
      return NextResponse.json({ error: "Profesional no encontrado." }, { status: 404 });
    }

    // "Las más exitosas" se ordena por cantidad de vistas, con la fecha como
    // desempate. Hoy el desempate hace casi todo el trabajo: el sitio tiene muy
    // pocos eventos de vista registrados, así que en la práctica esto devuelve
    // los artículos recientes. El orden mejora solo, sin tocar nada, en cuanto
    // entre tráfico real.
    const publicaciones = await prisma.post.findMany({
      where: { authorId: professional.id, status: "PUBLISHED" },
      orderBy: [{ viewEvents: { _count: "desc" } }, { createdAt: "desc" }],
      take: MAX_PUBLICACIONES,
      select: { slug: true, title: true, createdAt: true },
    });

    return NextResponse.json({
      id: professional.id,
      slug: professional.slug,
      name: professional.user?.name || "Profesional",
      image: professional.user?.image || "",
      specialty: professional.specialty || "",
      licenseNumber: professional.licenseNumber || "",
      review: professional.profileReview || "",
      services: professional.serviceAssignments
        .map((assignment) => assignment.service)
        .filter(Boolean),
      posts: publicaciones.map((post) => ({
        slug: post.slug,
        title: post.title,
        createdAt: post.createdAt ? post.createdAt.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("Error cargando ficha de profesional:", error);
    return NextResponse.json({ error: "No se pudo cargar la ficha." }, { status: 500 });
  }
}
