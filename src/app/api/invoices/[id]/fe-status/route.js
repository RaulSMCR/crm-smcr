// src/app/api/invoices/[id]/fe-status/route.js
// Consulta el estado de un comprobante electrónico en Hacienda CR
// y actualiza el registro en DB si cambió.
//
// GET /api/invoices/:id/fe-status
// Auth: ADMIN

import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-guards";
import { enqueueDelivery } from "@/lib/delivery-jobs";
import { processPaymentDeliveries } from "@/lib/payment-deliveries";

export const dynamic = "force-dynamic";

const FE_REAL_API_URL = process.env.FE_API_URL || null;



export async function GET(_request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String((await params)?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, feClave: true, feNumber: true, feXml: true, feStatus: true, feErrorMessage: true },
    });

    if (!invoice) return NextResponse.json({ message: "Factura no encontrada." }, { status: 404 });
    if (!invoice.feClave) {
      return NextResponse.json({ message: "La factura no ha sido enviada a FE aún." }, { status: 409 });
    }

    // Si ya está resuelta, devolver sin consultar Hacienda
    if (invoice.feStatus === "ACCEPTED") {
      return NextResponse.json({
        feStatus: "ACCEPTED", feNumber: invoice.feNumber, feClave: invoice.feClave, feErrorMessage: null,
      });
    }

    if (!FE_REAL_API_URL) {
      return NextResponse.json({
        feStatus: invoice.feStatus,
        feNumber: invoice.feNumber,
        feClave:  invoice.feClave,
        feErrorMessage: invoice.feErrorMessage,
        mock: true,
      });
    }

    // Consultar Hacienda
    const { pollStatus, feResult } = await import("@/lib/fe/client.js");
    let data;
    try {
      data = await pollStatus(invoice.feClave, null, { maxAttempts: 1 });
    } catch {
      return NextResponse.json({ message: "No se pudo consultar Hacienda. El comprobante se conserva." }, { status: 502 });
    }

    const result = feResult(data, invoice);
    const saved = await prisma.$transaction(async (tx) => {
      await tx.invoice.updateMany({ where: { id, feClave: invoice.feClave,
        feStatus: result.feStatus === "PENDING" ? "PENDING" : { not: "ACCEPTED" },
      }, data: { feStatus: result.feStatus, feErrorMessage: result.feErrorMessage,
        ...(result.respuestaXml ? { feRespuestaXml: result.respuestaXml } : {}),
      } });
      const current = await tx.invoice.findUnique({ where: { id }, select: { feStatus: true, feErrorMessage: true, feXml: true } });
      if (current.feStatus === "ACCEPTED" && current.feXml) await enqueueDelivery(tx, { kind: "FE_RECEIPT", invoiceId: id });
      return current;
    });
    after(() => processPaymentDeliveries({ invoiceId: id }).catch(() => console.error("[FE] DELIVERY_DISPATCH_FAILED")));

    return NextResponse.json({
      feStatus:      saved.feStatus,
      feNumber:      invoice.feNumber,
      feClave:       invoice.feClave,
      feErrorMessage: saved.feErrorMessage,
      haciendaStatus: result.haciendaStatus,
    });
  } catch {
    console.error("[FE] STATUS_QUERY_FAILED");
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
