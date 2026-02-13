// src/lib/auth.js
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

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

export async function getSession() {
  const cookieStore = cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

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
