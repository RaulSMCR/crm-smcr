// src/app/api/mock/payment/approve/route.js
// Endpoint GET para aprobar un pago mock directamente desde un link de email.
// El paciente hace click en el link → el pago se aprueba → redirige al panel.
// Solo activo cuando PLACETOPAY_MOCK=true.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSession, updateSession } from "@/lib/placetopay/mock-store";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (process.env.PLACETOPAY_MOCK !== "true") {
    return NextResponse.redirect(new URL("/panel/paciente", request.url));
  }

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");
  const APP_URL = process.env.APP_URL || "http://localhost:3000";

  if (!requestId) {
    return NextResponse.redirect(
      new URL("/panel/paciente?paymentResult=error", request.url)
    );
  }

  const session = getSession(requestId);
  if (!session) {
    // La sesión expiró (reinicio de servidor en dev) — redirigir con aviso
    return NextResponse.redirect(
      new URL("/panel/paciente?paymentResult=expired", request.url)
    );
  }

  const secretKey = process.env.PLACETOPAY_SECRET_KEY || "smcr_mock_secret_testing_2026";
  const status = "APPROVED";
  const date = new Date().toISOString();

  const signature = crypto
    .createHash("sha1")
    .update(`${requestId}${status}${date}${secretKey}`)
    .digest("hex");

  const webhookPayload = {
    requestId: Number(requestId),
    status: {
      status,
      reason: "00",
      message: "Aprobada",
      date,
    },
    signature,
  };

  updateSession(requestId, { status, date, reason: "00" });

  const webhookUrl = session.notifyUrl || `${APP_URL}/api/payment/webhook`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });
  } catch (err) {
    console.error("[Mock Approve] Error llamando webhook:", err.message);
  }

  return NextResponse.redirect(
    new URL("/panel/paciente?paymentResult=approved", request.url)
  );
}
