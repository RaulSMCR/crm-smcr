// src/lib/auth.js
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SESSION_COOKIE = "smcr_session";

export function getSessionToken() {
  return cookies().get(SESSION_COOKIE)?.value || null;
}

export function requireAdmin() {
  const token = getSessionToken();
  if (!token) throw new Error("UNAUTHORIZED");

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing");

  const payload = jwt.verify(token, secret);
  if (payload?.role !== "ADMIN") throw new Error("FORBIDDEN");

  return payload;
}
