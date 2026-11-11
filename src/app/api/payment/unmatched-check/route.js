// src/app/api/payment/unmatched-check/route.js
// Verificación diferida de un aviso de ONVO que llegó sin enlace.
//
// La programa el webhook (`programarVerificacionDePago`) unos 5 minutos después
// de un payment-intent.succeeded que no se pudo emparejar. Para entonces lo
// normal es que el checkout-session.succeeded ya haya acreditado el cobro: el
// pendiente se cierra en silencio. Si no, recién ahí se avisa al admin.
//
// Idempotente: la decisión y el candado de la alerta viven en la base
// (verificarPendienteDiferido), así que un reintento de QStash o un mensaje
// duplicado no repiten la alerta. Si el correo falla se suelta el candado y se
// responde 500 para que QStash reintente.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withQstashSignature } from "@/lib/qstash-webhook";
import { checkoutSessionDelEvento, paymentIntentDelEvento } from "@/lib/onvo/event";
import { normalizeEventAmount } from "@/lib/onvo/match-payment";
import { liberarAlerta, verificarPendienteDiferido } from "@/lib/onvo/process-payment";
import { sendAdminPaymentAlert } from "@/lib/onvo/payment-alert";
import { logOnvoWebhook } from "@/lib/onvo/observability";

export const dynamic = "force-dynamic";

async function handler(request) {
  let unmatchedId = "";
  try {
    const body = await request.json();
    unmatchedId = typeof body?.unmatchedId === "string" ? body.unmatchedId : "";
  } catch {
    // Cuerpo inválido: se trata igual que un id ausente.
  }
  // 200 para que QStash no reintente un mensaje que nunca va a servir.
  if (!unmatchedId) return NextResponse.json({ ok: false }, { status: 200 });

  try {
    const result = await verificarPendienteDiferido(prisma, unmatchedId);
    logOnvoWebhook("info", "DEFERRED_CHECK", { unmatchedId, result: result.kind });
    if (result.kind !== "alert") return NextResponse.json({ ok: true, result: result.kind });

    const { unmatched, alertedAt } = result;
    const enviada = await sendAdminPaymentAlert({
      subject: `⚠ Pago ONVO no conciliado (${unmatched.reason})`,
      reason: `${unmatched.reason}: el cobro sigue sin acreditar después de la espera`,
      eventId: unmatched.onvoEventId,
      onvoLinkId: unmatched.onvoLinkId,
      amount: normalizeEventAmount(unmatched.amount),
      currency: unmatched.currency,
      paymentIntentId: paymentIntentDelEvento(unmatched.payload),
      checkoutSessionId: checkoutSessionDelEvento(unmatched.payload),
    }).catch(() => false);

    if (!enviada) {
      await liberarAlerta(prisma, unmatchedId, alertedAt);
      logOnvoWebhook("error", "DEFERRED_ALERT_FAILED", { unmatchedId });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true, result: "alerted" });
  } catch (error) {
    logOnvoWebhook("error", "DEFERRED_CHECK_FAILED", { unmatchedId, error });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const POST = withQstashSignature(handler);
