// src/app/api/auth/login/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setSessionCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

class AuthError extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.code = code;
    this.extra = extra;
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/auth/login" });
}

async function readJsonCredentials(request) {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return { email: "", password: "" };

  try {
    const body = await request.json();
    return {
      email: String(body?.email || "").trim().toLowerCase(),
      password: String(body?.password || ""),
    };
  } catch {
    return { email: "", password: "" };
  }
}

export async function POST(request) {
  try {
    const { email, password } = await readJsonCredentials(request);

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email y contraseña requeridos" },
        { status: 400 }
      );
    }

    // 1) Buscar SIEMPRE en User (porque ProfessionalProfile depende de User)
    const user = await prisma.user.findUnique({
      where: { email },
      include: { professionalProfile: true },
    });

    // 2) No revelar si existe el email
    if (!user) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });
    }

    // 3) IMPORTANTE: tu schema dice `password` (debería ser passwordHash)
    // Mientras no migres, comparamos contra user.password.
    // En cuanto migres a passwordHash, cambia aquí a user.passwordHash.
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });
    }

    // 4) Email verificado
    if (!user.emailVerified) {
      return NextResponse.json(
        { message: "Debes verificar tu email primero.", error: "EMAIL_NOT_VERIFIED" },
        { status: 403 }
      );
    }

    // 5) Profesional requiere aprobación (tu schema lo pone en User)
    if (user.role === "PROFESSIONAL" && user.isApproved === false) {
      return NextResponse.json(
        { message: "Cuenta en revisión por administración.", error: "PRO_NOT_APPROVED" },
        { status: 403 }
      );
    }

    // 6) Firmar token con lo mínimo + flags útiles para middleware
    const token = await signToken({
      userId: user.id,
      role: user.role,
      email: user.email,
      isApproved: user.isApproved,
      emailVerified: user.emailVerified,
      // Si quieres, puedes pasar el id del profile para evitar queries en panel pro:
      professionalProfileId: user.professionalProfile?.id || null,
    });

    // 7) Respuesta
    const res = NextResponse.json({
      ok: true,
      role: user.role,
      userId: user.id,
      name: user.name,
      email: user.email,
      professionalProfileId: user.professionalProfile?.id || null,
    });

    setSessionCookie(res, token);
    return res;
  } catch (e) {
    console.error("❌ ERROR FATAL EN LOGIN:", e);

    const body =
      process.env.NODE_ENV === "production"
        ? { message: "Error interno del servidor" }
        : { message: "Error interno del servidor", detail: e?.message };

    return NextResponse.json(body, { status: 500 });
  }
}
