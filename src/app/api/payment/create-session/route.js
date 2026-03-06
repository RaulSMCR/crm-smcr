// src/app/api/payment/create-session/route.js
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initiateDepositPayment, initiateBalancePayment } from "@/actions/payment-actions";

export const dynamic = "force-dynamic";

/**
 * POST /api/payment/create-session
 * Body: { appointmentId: string, paymentType: "DEPOSIT" | "BALANCE" }
 *
 * Crea una sesión de pago en PlacetoPay y devuelve processUrl.
 * Auth: USER (paciente) o ADMIN
 */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    }
    if (session.role !== "USER" && session.role !== "ADMIN") {
      return NextResponse.json({ message: "Acción no permitida." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { appointmentId, paymentType } = body;

    if (!appointmentId) {
      return NextResponse.json({ message: "appointmentId es requerido." }, { status: 400 });
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "Mozilla/5.0";

    let result;
    if (paymentType === "BALANCE") {
      result = await initiateBalancePayment(appointmentId, { ipAddress, userAgent });
    } else {
      result = await initiateDepositPayment(appointmentId, { ipAddress, userAgent });
    }

    if (!result.success) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { processUrl: result.processUrl, requestId: result.requestId },
      { status: 200 }
    );
  } catch (error) {
    console.error("[payment] create-session error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
