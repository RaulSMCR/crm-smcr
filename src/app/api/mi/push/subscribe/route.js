// src/app/api/mi/push/subscribe/route.js
// Alta/baja de suscripciones Web Push del paciente. Protegido por el middleware
// (/api/mi) y revalidado con requirePatientSession (defensa en profundidad).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/mi/api-session";

export const dynamic = "force-dynamic";

// POST: registra/actualiza la suscripción de este dispositivo para el usuario.
export async function POST(request) {
  const auth = await requirePatientSession(request);
  if (auth instanceof NextResponse) return auth;

  const userId = String(auth.session.userId || auth.session.sub);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const authKey = body?.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Suscripción incompleta." }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) || null;

  // upsert por endpoint: si el dispositivo ya estaba registrado (incluso a otro
  // usuario), queda adjudicado al de la sesión actual.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh, auth: authKey, userAgent },
    create: { userId, endpoint, p256dh, auth: authKey, userAgent },
  });

  return NextResponse.json({ ok: true });
}

// DELETE: baja de la suscripción, solo si pertenece al usuario de la sesión.
export async function DELETE(request) {
  const auth = await requirePatientSession(request);
  if (auth instanceof NextResponse) return auth;

  const userId = String(auth.session.userId || auth.session.sub);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const endpoint = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint requerido." }, { status: 400 });
  }

  // deleteMany con userId: aislamiento — no borra suscripciones de otros usuarios.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });

  return NextResponse.json({ ok: true });
}
