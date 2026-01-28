import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setSessionCookie } from "@/lib/auth";
import bcrypt from "bcryptjs"; // <--- Importación ESTÁNDAR (Clave para que funcione en Vercel)

// Clase de error personalizada para manejar lógica de negocio
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
  if (!ct.includes("application/json")) {
    return { email: "", password: "", roleHint: "" };
  }
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const roleHint = String(body?.roleHint || "").toUpperCase();
    return { email, password, roleHint };
  } catch {
    return { email: "", password: "", roleHint: "" };
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

    // Definir orden de búsqueda
    const tryOrder = roleHint === "USER" ? ["USER", "PROFESSIONAL"] : ["PROFESSIONAL", "USER"];

    // Función para buscar Usuario
    const tryUser = async () => {
      const user = await prisma.user.findUnique({
        where: { email },
      });
      if (!user) return null;

      // Usamos la librería importada arriba
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) throw new AuthError("INVALID_CREDENTIALS");

      if (!user.emailVerified) {
        throw new AuthError("EMAIL_NOT_VERIFIED", { entity: "USER" });
      }

      return {
        role: user.role || "USER",
        id: user.id,
        name: user.name,
        email: user.email,
      };
    };

    // Función para buscar Profesional
    const tryProfessional = async () => {
      const pro = await prisma.professional.findUnique({
        where: { email },
      });
      if (!pro) return null;

      const isValid = await bcrypt.compare(password, pro.passwordHash);
      if (!isValid) throw new AuthError("INVALID_CREDENTIALS");

      if (!pro.emailVerified) {
        // NOTA: Como creaste el Admin con seed, verifica que tenga emailVerified=true
        throw new AuthError("EMAIL_NOT_VERIFIED", { entity: "PROFESSIONAL" });
      }

      if (!pro.isApproved) {
        throw new AuthError("PRO_NOT_APPROVED");
      }

      return { role: "PROFESSIONAL", id: pro.id, name: pro.name, email: pro.email };
    };

    // Ejecutar lógica de búsqueda
    let auth = null;
    for (const who of tryOrder) {
      // Atrapamos errores específicos dentro del bucle para no romper el flujo si uno falla por credenciales
      try {
        auth = who === "PROFESSIONAL" ? await tryProfessional() : await tryUser();
        if (auth) break; 
      } catch (innerError) {
        if (innerError instanceof AuthError) throw innerError; // Si es error de validación, lo lanzamos arriba
        // Si no encontró usuario, simplemente seguimos al siguiente
      }
    }

    if (!auth) {
      // Si llegamos aquí y auth es null, es que no existe el email
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
    }

    // Firmar Token
    const token = await signToken({ 
      userId: auth.id, 
      role: auth.role, 
      email: auth.email 
    });

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
    // --- Manejo de Errores Controlados ---
    if (e instanceof AuthError) {
      if (e.code === "INVALID_CREDENTIALS") {
        return NextResponse.json({ message: "Contraseña incorrecta" }, { status: 401 });
      }
      if (e.code === "EMAIL_NOT_VERIFIED") {
        return NextResponse.json(
          { message: "Debes verificar tu email primero.", error: "EMAIL_NOT_VERIFIED" },
          { status: 403 }
        );
      }
      if (e.code === "PRO_NOT_APPROVED") {
        return NextResponse.json(
          { message: "Cuenta en revisión por administración." },
          { status: 403 }
        );
      }
    }

    // --- Manejo de Errores INESPERADOS (El famoso 500) ---
    console.error("❌ ERROR FATAL EN LOGIN:", e); // Esto aparecerá en los logs de Vercel
    
    return NextResponse.json(
      { 
        message: "Error interno del servidor", 
        detail: e.message // Solo para debug, puedes quitarlo en prod
      }, 
      { status: 500 }
    );
  }
}