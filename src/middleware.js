// src/middleware.js
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

function getEncodedKey() {
  const secret = process.env.SESSION_SECRET;

  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("Missing or weak SESSION_SECRET in production.");
  }

  const effective = secret && secret.length >= 16 ? secret : "dev-only-insecure-secret";
  return new TextEncoder().encode(effective);
}

const encodedKey = getEncodedKey();

// Públicas exactas (solo esa ruta exacta)
const PUBLIC_EXACT = new Set([
  "/",
  "/ingresar",
  "/recuperar",
  "/registro",
  "/registro/usuario",
  "/registro/profesional",
  "/contacto",
  "/faq",
  "/nosotros",
  "/servicios",
  "/espera-aprobacion",
]);

// Públicas por prefijo (permiten subrutas)
const PUBLIC_PREFIX = [
  "/blog",
  // agrega aquí otras secciones públicas con slugs
];

// API de auth pública
const API_AUTH_PREFIX = "/api/auth";

// Rutas protegidas por rol
const PROTECTED_ROUTES = [
  { prefix: "/panel/admin", role: "ADMIN" },
  { prefix: "/panel/profesional", role: "PROFESSIONAL" },
  { prefix: "/panel/paciente", role: "USER" },

  { prefix: "/api/admin", role: "ADMIN" },

  // ⚠️ Ajusta estos prefijos a tus APIs reales cuando existan:
  // { prefix: "/api/professional", role: "PROFESSIONAL" },
  // { prefix: "/api/appointments", role: "USER" }, etc.
];

async function getPayloadFromCookie(request) {
  const token = request.cookies.get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

function isPublicPath(pathname) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // A) Ignorar estáticos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  const isApiAuth = pathname.startsWith(API_AUTH_PREFIX);
  const isPublic = isPublicPath(pathname);

  // B) Permitir públicas y /api/auth
  if (isPublic || isApiAuth) {
    // Si está logueado e intenta /ingresar, mandarlo a su panel
    const payload = await getPayloadFromCookie(request);
    if (payload && pathname === "/ingresar") {
      if (payload.role === "ADMIN") return NextResponse.redirect(new URL("/panel/admin", request.url));
      if (payload.role === "PROFESSIONAL") return NextResponse.redirect(new URL("/panel/profesional", request.url));
      return NextResponse.redirect(new URL("/panel/paciente", request.url));
    }
    return NextResponse.next();
  }

  // C) ¿Ruta protegida?
  const rule = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const payload = await getPayloadFromCookie(request);

  // 1) Sin sesión
  if (!payload) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/ingresar", request.url);
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  // 2) Profesional no aprobado (panel profesional)
  if (payload.role === "PROFESSIONAL" && payload.isApproved === false) {
    // Permitir que vea SOLO la espera y quizás su página de integraciones/perfil si la necesitas:
    if (
      pathname.startsWith("/panel/profesional") &&
      pathname !== "/espera-aprobacion"
    ) {
      return NextResponse.redirect(new URL("/espera-aprobacion", request.url));
    }

    // Si luego proteges APIs de profesional, aquí también podrías bloquearlas:
    // if (pathname.startsWith("/api/professional")) return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  // 3) Rol incorrecto
  if (payload.role !== rule.role) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let target = "/ingresar";
    if (payload.role === "ADMIN") target = "/panel/admin";
    else if (payload.role === "PROFESSIONAL") target = "/panel/profesional";
    else target = "/panel/paciente";

    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
