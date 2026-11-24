import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ message: "No autorizado." }, { status: 403 });
  const url = new URL(request.url); const year = Number(url.searchParams.get("year")); const month = Number(url.searchParams.get("month"));
  const period = await prisma.fiscalPeriod.findUnique({ where: { year_month: { year, month } } });
  if (!period?.snapshot) return NextResponse.json({ message: "Cierre el período antes de exportar." }, { status: 409 });
  // TODO validar casillas exactas con el contador.
  const snap = period.snapshot;
  const v = (x) => Number(x || 0);
  // Base neta de notas de crédito, como la cuota. Los cierres hechos antes de
  // guardar `baseVentas` se recalculan desde los agregados congelados.
  const baseVentas = snap.baseVentas ?? v(snap.sales?._sum?.subtotal) - Math.abs(v(snap.salesCredits?._sum?.subtotal));
  const baseCompras = snap.baseCompras ?? v(snap.purchases?._sum?.subtotal) - Math.abs(v(snap.purchaseCredits?._sum?.subtotal));
  const rows = [["Concepto", "Base", "Cuota"], ["Ventas netas", baseVentas.toFixed(2), v(snap.ivaDebito).toFixed(2)], ["Compras aceptadas", baseCompras.toFixed(2), v(snap.ivaCredito).toFixed(2)], ["IVA neto", "", v(period.ivaNeto).toFixed(2)]];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="D-104-${year}-${month}.csv"` } });
}
