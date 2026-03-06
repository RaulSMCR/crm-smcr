// src/app/api/payment/status/[requestId]/route.js
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { querySession } from "@/lib/placetopay/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/payment/status/[requestId]
 * Auth: USER (dueño de la cita) o ADMIN
 *
 * Consulta el estado de una transacción: primero en DB, luego en P2P si está PROCESSING.
 */
export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    }

    const requestId = Number(params.requestId);
    if (!requestId || isNaN(requestId)) {
      return NextResponse.json({ message: "requestId inválido." }, { status: 400 });
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { p2pRequestId: requestId },
      include: {
        appointment: { select: { patientId: true, paymentStatus: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json({ message: "Transacción no encontrada." }, { status: 404 });
    }

    // Solo el dueño o un admin puede consultar
    const isAdmin = session.role === "ADMIN";
    const isOwner = transaction.appointment?.patientId === session.sub;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }

    // Si está PROCESSING, consultar estado real en P2P
    if (transaction.status === "PROCESSING") {
      try {
        const p2pData = await querySession(requestId);
        const statusMap = {
          APPROVED: "APPROVED",
          REJECTED: "REJECTED",
          PENDING:  "PROCESSING",
          FAILED:   "REJECTED",
          EXPIRED:  "EXPIRED",
        };
        const freshStatus = statusMap[p2pData.status] || transaction.status;

        return NextResponse.json({
          transactionId: transaction.id,
          type:          transaction.type,
          amount:        Number(transaction.amount),
          currency:      transaction.currency,
          status:        freshStatus,
          p2pStatus:     p2pData.status,
          p2pMessage:    p2pData.message,
          appointmentPaymentStatus: transaction.appointment?.paymentStatus,
        });
      } catch {
        // Si P2P no responde, devolver estado local
      }
    }

    return NextResponse.json({
      transactionId: transaction.id,
      type:          transaction.type,
      amount:        Number(transaction.amount),
      currency:      transaction.currency,
      status:        transaction.status,
      p2pStatusCode: transaction.p2pStatusCode,
      p2pStatusMessage: transaction.p2pStatusMessage,
      p2pPaymentDate:   transaction.p2pPaymentDate,
      appointmentPaymentStatus: transaction.appointment?.paymentStatus,
    });
  } catch (error) {
    console.error("[payment] status route error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
