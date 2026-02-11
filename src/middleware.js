// PATH: src/middleware.js
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Públicas exactas
const PUBLIC_EXACT = new Set([
  "/",
  "/ingresar",
  "/recuperar",
  "/cambiar-password",
  "/registro",
  "/registro/usuario",
  "/registro/profesional",
  "/contacto",
  "/faq",
  "/nosotros",
  "/servicios",
  "/espera-aprobacion",
  "/verificar-email",
]);

// Públicas por prefijo
const PUBLIC_PREFIX = ["/blog"];

// API auth pública
const API_AUTH_PREFIX = "/api/auth";

// Protegidas por rol
const PROTECTED_ROUTES = [
  { prefix: "/panel/admin", role: "ADMIN" },
  { prefix: "/panel/profesional", role: "PROFESSIONAL" },
  { prefix: "/panel/paciente", role: "USER" },
  { prefix: "/api/admin", role: "ADMIN" },
];

// ---- Secret defensivo (NO rompe middleware) ----
function getEncodedKeySafe() {
  const secret = process.env.SESSION_SECRET;

  // En producción debería existir y ser fuerte
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      console.error("❌ SESSION_SECRET missing/weak in production (middleware).");
      return null; // señal de misconfig
    }
  }

  // Dev/Preview: fallback para no caerse
  const effective =
    secret && secret.length >= 16 ? secret : "dev-only-insecure-secret";
  return new TextEncoder().encode(effective);
}

function isPublicPath(pathname) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function getPayloadFromCookie(request, encodedKey) {
  const token = request.cookies.get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
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

  const isPublic = isPublicPath(pathname);
  const isApiAuth = pathname.startsWith(API_AUTH_PREFIX);

  // B) Permitir públicas y /api/auth
  if (isPublic || isApiAuth) {
    // si está logueado e intenta /ingresar, mandarlo a su panel
    const encodedKey = getEncodedKeySafe();
    if (encodedKey && pathname === "/ingresar") {
      const payload = await getPayloadFromCookie(request, encodedKey);
      if (payload?.role === "ADMIN")
        return NextResponse.redirect(new URL("/panel/admin", request.url));
      if (payload?.role === "PROFESSIONAL")
        return NextResponse.redirect(new URL("/panel/profesional", request.url));
      if (payload?.role === "USER")
        return NextResponse.redirect(new URL("/panel/paciente", request.url));
    }
    return NextResponse.next();
  }

  // C) ¿Ruta protegida?
  const rule = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  // D) Si falta secret en prod, no rompemos middleware: devolvemos 503/redirect
  const encodedKey = getEncodedKeySafe();
  if (!encodedKey) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Server misconfigured (SESSION_SECRET)" },
        { status: 503 }
      );
    }
    const url = new URL("/ingresar", request.url);
    url.searchParams.set("error", "server_misconfigured");
    return NextResponse.redirect(url);
  }

  const payload = await getPayloadFromCookie(request, encodedKey);

  // 1) Sin sesión
  if (!payload) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/ingresar", request.url);
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  // 2) Profesional no aprobado
  if (payload.role === "PROFESSIONAL" && payload.isApproved === false) {
    if (pathname.startsWith("/panel/profesional")) {
      return NextResponse.redirect(new URL("/espera-aprobacion", request.url));
    }
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
