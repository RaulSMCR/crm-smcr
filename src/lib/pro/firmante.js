// src/lib/pro/firmante.js
//
// Quién está manejando sus firmas: el profesional de la sesión, con perfil
// aprobado. El slug sale de la base y no del pedido: nadie puede ver, subir ni
// borrar las firmas de otro. En «ver como» el administrador mira, no firma.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";

export async function requireFirmante() {
  const session = await getSession();
  const deny = (status, message) => ({ error: NextResponse.json({ message }, { status }) });
  if (!session) return deny(401, "Sesión requerida.");
  if (isPreviewSession(session)) return deny(403, PREVIEW_BLOCKED_MESSAGE);
  if (session.role !== "PROFESSIONAL") return deny(403, "Solo los profesionales guardan firmas.");

  const userId = String(session.sub || session.userId || "");
  const perfil = userId
    ? await prisma.professionalProfile.findUnique({ where: { userId }, select: { slug: true, isApproved: true } })
    : null;
  if (!perfil?.isApproved || !perfil.slug) return deny(403, "El perfil profesional no está aprobado.");
  return { slug: perfil.slug };
}
