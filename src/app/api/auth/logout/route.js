// PATH: src/app/api/auth/logout/route.js
import { NextResponse } from "next/server";

/**
 * Logout por API (para evitar 404 cuando alguien visita /api/auth/logout).
 * Borra la cookie httpOnly "session" y redirige a /ingresar.
 *
 * Nota:
 * - Tu logout “oficial” puede seguir siendo la Server Action `logout()` en src/actions/auth-actions.js
 * - Este endpoint solo es un “compat layer” para URLs antiguas o links directos.
 */

function clearSessionCookie(res) {
  // NextResponse cookies API
  res.cookies.set({
    name: "session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // Por si quedó algún cookie legacy (no debería, pero evita fantasmas)
  res.cookies.set({
    name: "sessionToken",
    value: "",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(request) {
  const url = new URL("/ingresar", request.url);
  const res = NextResponse.redirect(url, { status: 302 });
  clearSessionCookie(res);
  return res;
}

export async function POST(request) {
  // Para logout desde fetch()
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
