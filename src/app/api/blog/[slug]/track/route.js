// src/app/api/blog/[slug]/track/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const ONE_YEAR = 60 * 60 * 24 * 365;
const THIRTY_MIN = 60 * 30;

function safeStr(v, max = 2000) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(req, { params }) {
  const slug = params.slug;

  const body = await req.json().catch(() => ({}));
  const landingUrl = safeStr(body?.landingUrl, 4000);
  const referrer = safeStr(body?.referrer, 4000);

  const utmSource = safeStr(body?.utm?.utm_source, 120);
  const utmMedium = safeStr(body?.utm?.utm_medium, 120);
  const utmCampaign = safeStr(body?.utm?.utm_campaign, 160);
  const utmTerm = safeStr(body?.utm?.utm_term, 160);
  const utmContent = safeStr(body?.utm?.utm_content, 160);

  // 1) Post publicado
  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true },
  });

  if (!post) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // 2) Cookies
  const cookieStore = cookies();
  const existingAnon = cookieStore.get("anon_id")?.value || null;
  const existingSess = cookieStore.get("sess_id")?.value || null;

  const anonId = existingAnon || randomUUID();
  const sessionId = existingSess || randomUUID();

  const userAgent = safeStr(req.headers.get("user-agent"), 1500);
  const country = safeStr(req.headers.get("x-vercel-ip-country"), 8);

  // 3) Upsert por (sessionId, postId): 1 evento por sesión/post
  const event = await prisma.postViewEvent.upsert({
    where: { sessionId_postId: { sessionId, postId: post.id } },
    create: {
      postId: post.id,
      anonId,
      sessionId,
      landingUrl,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      userAgent,
      country,
    },
    update: {
      // opcional: refrescamos datos si el usuario re-carga
      landingUrl,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      userAgent,
      country,
    },
    select: { id: true },
  });

  // 4) Respuesta + set cookies
  const res = NextResponse.json({ ok: true, eventId: event.id });

  // anon_id (persistente)
  if (!existingAnon) {
    res.cookies.set("anon_id", anonId, {
      httpOnly: true,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_YEAR,
    });
  }

  // sess_id (sliding: lo re-seteamos siempre para extender)
  res.cookies.set("sess_id", sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_MIN,
  });

  return res;
}
