import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAdminViewToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    const response = NextResponse.json({ ok: true, role: role || "ADMIN" });
    if (!role || role === "ADMIN") {
      clearViewCookie(response);
      return response;
    }
    if (!["USER", "PROFESSIONAL"].includes(role)) {
      return NextResponse.json({ error: "Vista no válida." }, { status: 400 });
    }

    const viewToken = await signAdminViewToken(adminId, role);
    response.cookies.set({ name: "admin_view", value: viewToken, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
    return response;
  } catch (error) {
    console.error("Admin view error:", error);
    return NextResponse.json({ error: "No se pudo cambiar la vista." }, { status: 500 });
  }
}
