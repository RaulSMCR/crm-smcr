import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_VIEW_MAX_AGE_SECONDS, signAdminViewToken, verifyAdminViewToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Aún no hay modelo de auditoría en el schema; hasta que exista, el rastro vive
 * en los logs del runtime. Una línea por activación y por salida, en JSON para
 * que sea consultable sin parsear texto libre.
 */
function logViewChange({ adminId, email, from, to }) {
  console.log(JSON.stringify({
    event: "admin.view-as",
    adminId,
    adminEmail: email || null,
    from,
    to,
    at: new Date().toISOString(),
  }));
}

function clearViewCookie(response) {
  response.cookies.set({ name: "admin_view", value: "", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(0) });
}

export async function POST(request) {
  try {
    const sessionToken = request.cookies.get("session")?.value;
    const baseSession = sessionToken ? await verifyToken(sessionToken) : null;
    const adminId = String(baseSession?.sub || baseSession?.userId || "");
    if (!adminId || baseSession?.role !== "ADMIN") {
      return NextResponse.json({ error: "Solo un administrador puede cambiar la vista." }, { status: 403 });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true, isActive: true } });
    if (!admin?.isActive || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Sesión administrativa inválida." }, { status: 403 });
    }

    const { role } = await request.json().catch(() => ({}));
    if (role && !["ADMIN", "USER", "PROFESSIONAL"].includes(role)) {
      return NextResponse.json({ error: "Vista no válida." }, { status: 400 });
    }

    const currentView = request.cookies.get("admin_view")?.value;
    const previous = currentView
      ? (await verifyAdminViewToken(currentView).catch(() => null))?.role || "ADMIN"
      : "ADMIN";
    const target = role || "ADMIN";
    const response = NextResponse.json({ ok: true, role: target });

    if (target === "ADMIN") {
      clearViewCookie(response);
      logViewChange({ adminId, email: baseSession.email, from: previous, to: "ADMIN" });
      return response;
    }

    const viewToken = await signAdminViewToken(adminId, target);
    response.cookies.set({ name: "admin_view", value: viewToken, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ADMIN_VIEW_MAX_AGE_SECONDS });
    logViewChange({ adminId, email: baseSession.email, from: previous, to: target });
    return response;
  } catch (error) {
    console.error("Admin view error:", error);
    return NextResponse.json({ error: "No se pudo cambiar la vista." }, { status: 500 });
  }
}
