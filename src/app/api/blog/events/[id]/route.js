// src/app/api/blog/events/[id]/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.trunc(n) : NaN;
  if (!Number.isFinite(x)) return undefined;
  return Math.max(min, Math.min(max, x));
}

async function handleUpdate(req, id) {
  const body = await req.json().catch(() => ({}));

  const timeOnPageSeconds = clampInt(Number(body?.timeOnPageSeconds), 0, 60 * 60); // 0..3600
  const scrollDepth = clampInt(Number(body?.scrollDepth), 0, 100); // 0..100
  const wantsRead = body?.isRead === true;

  const existing = await prisma.postViewEvent.findUnique({
    where: { id },
    select: {
      isRead: true,
      timeOnPageSeconds: true,
      scrollDepth: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Guardamos el máximo (para no “empeorar” valores)
  const nextTime =
    timeOnPageSeconds !== undefined
      ? Math.max(existing.timeOnPageSeconds || 0, timeOnPageSeconds)
      : undefined;

  const nextScroll =
    scrollDepth !== undefined
      ? Math.max(existing.scrollDepth || 0, scrollDepth)
      : undefined;

  const data = {
    ...(nextTime !== undefined ? { timeOnPageSeconds: nextTime } : {}),
    ...(nextScroll !== undefined ? { scrollDepth: nextScroll } : {}),
    ...(wantsRead && !existing.isRead ? { isRead: true, readAt: new Date() } : {}),
  };

  if (Object.keys(data).length > 0) {
    await prisma.postViewEvent.update({ where: { id }, data });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req, { params }) {
  return handleUpdate(req, params.id);
}

// Para sendBeacon (POST)
export async function POST(req, { params }) {
  return handleUpdate(req, params.id);
}
