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
  const rows = [["Concepto", "Base", "Cuota"], ["Ventas netas", period.snapshot.sales?._sum?.subtotal || 0, period.snapshot.ivaDebito || 0], ["Compras aceptadas", period.snapshot.purchases?._sum?.subtotal || 0, period.snapshot.ivaCredito || 0], ["IVA neto", "", period.ivaNeto || 0]];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="D-104-${year}-${month}.csv"` } });
}
