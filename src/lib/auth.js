import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "smcr_session";

function getJwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export function getSessionToken() {
  return cookies().get(SESSION_COOKIE)?.value || null;
}

export function setSessionCookie(token) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function signToken(payload, expiresInSeconds = 60 * 60 * 24 * 7) {
  const key = getJwtKey();
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(key);
}

export async function verifyToken(token) {
  const key = getJwtKey();
  const { payload } = await jwtVerify(token, key);
  return payload;
}

export async function requireAdmin() {
  const token = getSessionToken();
  if (!token) throw new Error("UNAUTHORIZED");

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    throw new Error("UNAUTHORIZED");
  }

  if (payload?.role !== "ADMIN") throw new Error("FORBIDDEN");
  return payload;
}
