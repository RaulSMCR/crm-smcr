// src/app/api/auth/login/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setSessionCookie } from "@/lib/auth";

/** GET de prueba para verificar que la ruta está viva */
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/auth/login" });
}

/** Lee credenciales SOLO desde JSON */
async function readJsonCredentials(request) {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return { email: "", password: "", roleHint: "" };
  }
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const roleHint = String(body?.roleHint || "").toUpperCase(); // opcional
    return { email, password, roleHint };
  } catch {
    return { email: "", password: "", roleHint: "" };
  }
}

async function comparePasswordBcrypt(plain, hash) {
  if (!hash) return false;
  try {
    const bcrypt = await import("bcryptjs");
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const { email, password, roleHint } = await readJsonCredentials(request);
    if (!email || !password) {
      return NextResponse.json(
        { message: "Email y contraseña requeridos" },
        { status: 400 }
      );
    }

    // Priorizamos PROFESSIONAL por defecto (evita colisiones con User)
    const tryOrder =
      roleHint === "USER" ? ["USER", "PROFESSIONAL"] : ["PROFESSIONAL", "USER"];

    const tryUser = async () => {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          passwordHash: true,
          emailVerified: true, // ✅
        },
      });
      if (!user) return null;

      const ok = await comparePasswordBcrypt(password, user.passwordHash);
      if (!ok) throw new Error("INVALID_CREDENTIALS");

      // ✅ Bloqueo por email no verificado
      if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

      return {
        role: user.role || "USER",
        id: user.id,
        name: user.name,
        email: user.email,
      };
    };

    const tryProfessional = async () => {
      const pro = await prisma.professional.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          passwordHash: true,
          isApproved: true,
          emailVerified: true, // ✅
        },
      });
      if (!pro) return null;

      const ok = await comparePasswordBcrypt(password, pro.passwordHash);
      if (!ok) throw new Error("INVALID_CREDENTIALS");

      // ✅ Bloqueo por email no verificado
      if (!pro.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

      // Mantener tu regla de aprobación
      if (!pro.isApproved) throw new Error("PRO_NOT_APPROVED");

      return { role: "PROFESSIONAL", id: pro.id, name: pro.name, email: pro.email };
    };

    let auth = null;
    for (const who of tryOrder) {
      auth = who === "PROFESSIONAL" ? await tryProfessional() : await tryUser();
      if (auth) break;
    }

    if (!auth) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
    }

    const token = await signToken({ userId: auth.id, role: auth.role, email: auth.email });

    const res = NextResponse.json({
      ok: true,
      role: auth.role,
      userId: auth.id,
      name: auth.name,
      email: auth.email,
    });

    setSessionCookie(res, token);
    return res;
  } catch (e) {
    if (e?.message === "INVALID_CREDENTIALS") {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });
    }
    if (e?.message === "EMAIL_NOT_VERIFIED") {
      return NextResponse.json(
        { message: "Tenés que confirmar tu correo antes de iniciar sesión." },
        { status: 403 }
      );
    }
    if (e?.message === "PRO_NOT_APPROVED") {
      return NextResponse.json(
        { message: "Tu cuenta de profesional está en revisión" },
        { status: 403 }
      );
    }

    console.error("POST /api/auth/login error:", e);
    return NextResponse.json({ message: "Error de autenticación" }, { status: 500 });
  }
}
