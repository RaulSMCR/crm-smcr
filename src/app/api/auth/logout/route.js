// src/app/api/auth/logout/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clearCookie(response, name) {
  response.cookies.set({
    name,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // Cookie actual
  clearCookie(res, "session");

  return res;
}

export async function GET() {
  return POST();
}
