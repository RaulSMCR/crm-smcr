// src/app/api/invoices/[id]/fe-status/route.js
// Consulta el estado de un comprobante electrónico en Hacienda CR
// y actualiza el registro en DB si cambió.
//
// GET /api/invoices/:id/fe-status
// Auth: ADMIN

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FE_REAL_API_URL = process.env.FE_API_URL || null;

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (session.role !== "ADMIN") return { error: NextResponse.json({ message: "Acción no permitida." }, { status: 403 }) };
  return { session };
}

export async function GET(_request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, feClave: true, feNumber: true, feStatus: true, feErrorMessage: true },
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
    const { pollStatus } = await import("@/lib/fe/client.js");
    let data;
    try {
      data = await pollStatus(invoice.feClave);
    } catch (err) {
      return NextResponse.json({ message: `Error consultando Hacienda: ${err.message}` }, { status: 502 });
    }

    const newStatus     = data.ind_estado === "aceptado" ? "ACCEPTED"
      : data.ind_estado === "rechazado" ? "REJECTED"
      : invoice.feStatus; // sin cambio si aún procesando

    const newError = data.ind_estado === "rechazado"
      ? (data.respuesta_xml || data.mensaje || "Rechazado por Hacienda")
      : null;

    if (newStatus !== invoice.feStatus) {
      await prisma.invoice.update({
        where: { id },
        data: { feStatus: newStatus, feErrorMessage: newError },
      });
    }

    return NextResponse.json({
      feStatus:      newStatus,
      feNumber:      invoice.feNumber,
      feClave:       invoice.feClave,
      feErrorMessage: newError,
      haciendaStatus: data.ind_estado,
    });
  } catch (error) {
    console.error("[invoices/:id/fe-status] GET error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
