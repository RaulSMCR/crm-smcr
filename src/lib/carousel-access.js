import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/** Compara secretos en tiempo constante (no filtra por timing). */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// El usuario admin al que se atribuye lo que crea el servidor MCP.
let _mcpAdminUserId = null;
async function resolveMcpAdminUserId() {
  if (_mcpAdminUserId) return _mcpAdminUserId;
  const email = String(process.env.MCP_ADMIN_EMAIL || "").trim();
  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
    : await prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true, role: true },
        orderBy: { createdAt: "asc" },
      });
  if (!user || user.role !== "ADMIN") return null;
  _mcpAdminUserId = String(user.id);
  return _mcpAdminUserId;
}

/**
 * Actor autorizado para operar carruseles: ADMIN o PROFESSIONAL aprobado.
 * Devuelve { actor } o { res } (respuesta de error lista para retornar).
 *
 * actor = { userId, role, profileId, isAdmin }
 *   - profileId: id del ProfessionalProfile (solo profesionales; null para admin).
 *
 * Dos vías de autenticación:
 *   1. Cookie de sesión (navegador) — el caso normal.
 *   2. `Authorization: Bearer <MCP_ADMIN_TOKEN>` — acceso de máquina para el
 *      servidor MCP. Da rol ADMIN atribuido a MCP_ADMIN_EMAIL.
 */
export async function getCarouselActor() {
  // Vía de máquina: si viene un Bearer, se resuelve aquí y no se cae a la sesión.
  const authHeader = (await headers()).get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const expected = String(process.env.MCP_ADMIN_TOKEN || "");
    const presented = authHeader.slice(7).trim();
    // Un token corto o ausente nunca autentica (evita habilitar admin por accidente).
    if (expected.length < 32 || !safeEqual(presented, expected)) {
      return { res: NextResponse.json({ message: "Token no válido" }, { status: 401 }) };
    }
    const userId = await resolveMcpAdminUserId();
    if (!userId) {
      return {
        res: NextResponse.json(
          { message: "No se encontró un usuario ADMIN para atribuir el acceso MCP." },
          { status: 500 }
        ),
      };
    }
    return { actor: { userId, role: "ADMIN", profileId: null, isAdmin: true } };
  }

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
