// src/app/api/mock/payment/complete/route.js
// Endpoint para simular la resolución de un pago en modo mock.
// Solo activo cuando PLACETOPAY_MOCK=true.
// Firma el payload igual que PlacetoPay real para que el webhook lo procese correctamente.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSession, updateSession } from "@/lib/placetopay/mock-store";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (process.env.PLACETOPAY_MOCK !== "true") {
    return NextResponse.json({ error: "Mock mode no está habilitado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { requestId, outcome } = body;

  if (!requestId) {
    return NextResponse.json({ error: "requestId es requerido." }, { status: 400 });
  }
  if (!["APPROVED", "REJECTED"].includes(outcome)) {
    return NextResponse.json({ error: "outcome debe ser APPROVED o REJECTED." }, { status: 400 });
  }

  const session = getSession(requestId);
  if (!session) {
    return NextResponse.json(
      { error: "Sesión mock no encontrada. Puede haber expirado al reiniciar el servidor." },
      { status: 404 }
    );
  }

  const secretKey = process.env.PLACETOPAY_SECRET_KEY || "smcr_mock_secret_testing_2026";
  const status    = outcome;
  const date      = new Date().toISOString();

  // Firma SHA1 idéntica a la fórmula de PlacetoPay real
  const signature = crypto
    .createHash("sha1")
    .update(`${requestId}${status}${date}${secretKey}`)
    .digest("hex");

  const webhookPayload = {
    requestId: Number(requestId),
    status: {
      status,
      reason: outcome === "APPROVED" ? "00" : "?P",
      message: outcome === "APPROVED" ? "Aprobada" : "Rechazada — simulación de fallo",
      date,
    },
    signature,
  };

  // Actualizar estado en el mock store
  updateSession(requestId, { status, date, reason: webhookPayload.status.reason });

  // Llamar al webhook de forma interna para ejercitar todo el stack
  const webhookUrl = session.notifyUrl || `${process.env.APP_URL || "http://localhost:3000"}/api/payment/webhook`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });
    const webhookResult = await res.json().catch(() => ({}));
    console.log(`[Mock P2P] Webhook llamado → ${res.status}`, webhookResult);
  } catch (err) {
    console.error("[Mock P2P] Error llamando webhook:", err.message);
    // No bloqueamos — la respuesta igual retorna el returnUrl para redirigir al usuario
  }

  return NextResponse.json({
    ok: true,
    outcome,
    requestId: Number(requestId),
    returnUrl: session.returnUrl || "/",
  });
}
