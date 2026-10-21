import { NextResponse } from "next/server";
import { getSession, isPreviewSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esEmisorResponsable } from "@/lib/api-guards";
import { PALIG_PROFESSIONAL_SLUG } from "@/lib/palig-policy";

/** Mantiene la autorización fiscal del admin y añade solo la cuenta de Raúl. */
export async function requirePaligOperator() {
  const session = await getSession();
  const deny = (status) => ({ error: NextResponse.json({ message: "No tiene acceso al piloto PALIG." }, { status }) });
  if (!session) return deny(401);
  if (isPreviewSession(session) || !["ADMIN", "PROFESSIONAL"].includes(session.role)) return deny(403);
  const id = String(session.sub || session.userId || "");
  if (!id) return deny(403);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, isActive: true, professionalProfile: { select: { id: true, slug: true, isApproved: true } } },
  });
  if (!user?.isActive || user.role !== session.role) return deny(403);
  const isAdmin = user.role === "ADMIN" && esEmisorResponsable(user.email);
  const isRaul = user.role === "PROFESSIONAL" && user.professionalProfile?.isApproved && user.professionalProfile.slug === PALIG_PROFESSIONAL_SLUG;
  if (!isAdmin && !isRaul) return deny(403);
  return { session, userId: user.id, isAdmin, professionalId: isRaul ? user.professionalProfile.id : null };
}
