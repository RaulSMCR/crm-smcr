import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Actor autorizado para operar carruseles: ADMIN o PROFESSIONAL aprobado.
 * Devuelve { actor } o { res } (respuesta de error lista para retornar).
 *
 * actor = { userId, role, profileId, isAdmin }
 *   - profileId: id del ProfessionalProfile (solo profesionales; null para admin).
 */
export async function getCarouselActor() {
  const session = await getSession();
  if (!session) {
    return { res: NextResponse.json({ message: "No autorizado" }, { status: 401 }) };
  }
  const userId = String(session.sub || session.userId || "");

  if (session.role === "ADMIN") {
    return { actor: { userId, role: "ADMIN", profileId: null, isAdmin: true } };
  }

  if (session.role === "PROFESSIONAL") {
    const profile = session.professionalProfile;
    if (!profile?.id) {
      return { res: NextResponse.json({ message: "Perfil profesional no encontrado" }, { status: 403 }) };
    }
    if (!profile.isApproved) {
      return {
        res: NextResponse.json(
          { message: "Tu cuenta aún no fue aprobada por un administrador." },
          { status: 403 }
        ),
      };
    }
    return { actor: { userId, role: "PROFESSIONAL", profileId: profile.id, isAdmin: false } };
  }

  return { res: NextResponse.json({ message: "Acción no permitida" }, { status: 403 }) };
}

/** ¿Puede el actor ver/editar este carrusel? Admin: todos. Profesional: solo propios. */
export function canAccessCarousel(actor, carousel) {
  return actor.isAdmin || carousel.createdBy === actor.userId;
}
