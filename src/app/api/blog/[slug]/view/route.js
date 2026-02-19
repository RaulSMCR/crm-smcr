// src/app/api/blog/[slug]/view/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(_req, { params }) {
  const slug = params.slug;

  const cookieStore = cookies();
  const cookieKey = `pv_${slug}`;

  // Dedupe simple: si ya contó en este dispositivo, no incrementar
  if (cookieStore.get(cookieKey)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true },
  });

  if (!post) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  await prisma.post.update({
    where: { id: post.id },
    data: { views: { increment: 1 } },
  });

  const res = NextResponse.json({ ok: true });

  // Cookie 24h
  res.cookies.set(cookieKey, "1", {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return res;
}
