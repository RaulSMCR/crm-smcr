// src/lib/auth.js
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;

  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("Missing or weak SESSION_SECRET. Set a strong value (>= 32 chars) in env.");
  }

  const effectiveSecret = secret && secret.length >= 16 ? secret : "dev-only-insecure-secret";
  return new TextEncoder().encode(effectiveSecret);
}

function sanitizeSessionPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  const out = {};

  if (payload.sub) out.sub = String(payload.sub);
  if (payload.userId) out.userId = String(payload.userId);

  if (payload.role) out.role = String(payload.role);
  if (payload.email) out.email = String(payload.email);
  if (payload.name) out.name = String(payload.name);

  if (payload.professionalProfileId) out.professionalProfileId = String(payload.professionalProfileId);
  if (payload.slug) out.slug = String(payload.slug);

  if (typeof payload.emailVerified === "boolean") out.emailVerified = payload.emailVerified;
  if (typeof payload.isApproved === "boolean") out.isApproved = payload.isApproved;
  if (payload.sessionVersion !== undefined) out.sessionVersion = Number(payload.sessionVersion) || 0;

  return out;
}

export async function signToken(payload) {
  const secretKey = getSecretKey();
  const safe = sanitizeSessionPayload(payload);

  return await new SignJWT(safe)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifyToken(token) {
  const secretKey = getSecretKey();
  const { payload } = await jwtVerify(token, secretKey);
  return payload;
}

export async function signAdminViewToken(adminId, role) {
  return await new SignJWT({ purpose: "admin-view", role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(adminId))
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getSecretKey());
}

export async function verifyAdminViewToken(token) {
  const { payload } = await jwtVerify(token, getSecretKey());
  if (payload.purpose !== "admin-view" || !["USER", "PROFESSIONAL"].includes(payload.role)) {
    return null;
  }
  return payload;
}

/**
 * Resuelve la sesión del request actual: verifica el JWT y contrasta
 * `sessionVersion` e `isActive` contra la base en cada request.
 *
 * Envuelta en `cache()` de React: las múltiples llamadas de un mismo request
 * (layout, página, server actions, componentes de servidor) comparten una sola
 * consulta. El caché muere con el request, así que la revocación sigue siendo
 * efectiva en el siguiente — no añadir caché entre requests (TTL, memoria
 * global, Redis) o se pierde esa garantía.
 */
export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const session = await verifyToken(token);
    const userId = String(session.sub || session.userId || "");
    if (!userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        sessionVersion: true,
        isActive: true,
        role: true,
        professionalProfile: { select: { id: true, slug: true, specialty: true, licenseNumber: true, isApproved: true } },
      },
    });
    if (!user?.isActive || Number(session.sessionVersion || 0) !== user.sessionVersion) return null;

    const viewToken = cookieStore.get("admin_view")?.value;
    if (user.role === "ADMIN" && viewToken) {
      try {
        const view = await verifyAdminViewToken(viewToken);
        if (view?.sub === userId) {
          return {
            ...session,
            role: view.role,
            actualRole: "ADMIN",
            isPreview: true,
            professionalProfile: user.professionalProfile || null,
            professionalProfileId: user.professionalProfile?.id || null,
            isApproved: view.role === "PROFESSIONAL" ? !!user.professionalProfile?.isApproved : true,
          };
        }
      } catch {
        // An invalid view cookie is ignored and the real admin session remains active.
      }
    }

    return { ...session, actualRole: user.role, isPreview: false, professionalProfile: user.professionalProfile || null };
  } catch {
    return null;
  }
});

export function setSessionCookie(response, token) {
  response.cookies.set({
    name: "session",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    // @ts-ignore
    priority: "high",
  });
}

export function removeSessionCookie(response) {
  response.cookies.set({
    name: "session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    // @ts-ignore
    priority: "high",
  });
}
