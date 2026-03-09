// src/app/api/mock/payment/approve/route.js
// Endpoint GET para aprobar un pago mock directamente desde un link de email.
// No depende del session store in-memory — busca la transacción en BD por p2pRequestId.
// Solo activo cuando PLACETOPAY_MOCK=true.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (process.env.PLACETOPAY_MOCK !== "true") {
    return NextResponse.redirect(new URL("/panel/paciente", request.url));
  }

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");
  const APP_URL = process.env.APP_URL || "http://localhost:3000";

  if (!requestId) {
    return NextResponse.redirect(new URL("/panel/paciente?paymentResult=error", request.url));
  }

  // Verificar que la transacción exista en BD (no dependemos del store in-memory)
  const tx = await prisma.paymentTransaction.findFirst({
    where: { p2pRequestId: Number(requestId) },
    select: { id: true, status: true },
  }).catch(() => null);

  if (!tx) {
    console.warn(`[Mock Approve] requestId ${requestId} no encontrado en BD.`);
    return NextResponse.redirect(new URL("/panel/paciente?paymentResult=error", request.url));
  }

  if (tx.status === "APPROVED") {
    return NextResponse.redirect(new URL("/panel/paciente?paymentResult=approved", request.url));
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
    status: { status, reason: "00", message: "Aprobada", date },
    signature,
  };

  try {
    const res = await fetch(`${APP_URL}/api/payment/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });
    console.log(`[Mock Approve] Webhook → ${res.status}`);
  } catch (err) {
    console.error("[Mock Approve] Error llamando webhook:", err.message);
  }

  return NextResponse.redirect(new URL("/panel/paciente?paymentResult=approved", request.url));
}
