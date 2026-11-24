import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ message: "No autorizado." }, { status: 403 });
  const url = new URL(request.url); const year = Number(url.searchParams.get("year")); const month = Number(url.searchParams.get("month"));
  const period = await prisma.fiscalPeriod.findUnique({ where: { year_month: { year, month } } });
  if (!period?.snapshot) return NextResponse.json({ message: "Cierre el período antes de exportar." }, { status: 409 });
  const snap = period.snapshot;
  const v = (x) => Number(x || 0);
  // Base neta de notas de crédito, como la cuota. Los cierres hechos antes de
  // guardar `baseVentas` se recalculan desde los agregados congelados.
  const baseVentas = snap.baseVentas ?? v(snap.sales?._sum?.subtotal) - Math.abs(v(snap.salesCredits?._sum?.subtotal));
  const baseCompras = snap.baseCompras ?? v(snap.purchases?._sum?.subtotal) - Math.abs(v(snap.purchaseCredits?._sum?.subtotal));
  const rows = snap.d104 ? filasD104(snap.d104, period) : [["Concepto", "Base", "Cuota"], ["Ventas netas", baseVentas.toFixed(2), v(snap.ivaDebito).toFixed(2)], ["Compras aceptadas", baseCompras.toFixed(2), v(snap.ivaCredito).toFixed(2)], ["IVA neto", "", v(period.ivaNeto).toFixed(2)]];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="D-104-${year}-${month}.csv"` } });
}

// Renglones con los nombres del formulario de IVA de TRIBU-CR, en el orden del
// que presentó el contador para septiembre de 2026. Es una guía para cargar la
// declaración a mano, no un archivo que Hacienda importe.
function filasD104(d, period) {
  const f = (x) => Number(x || 0).toFixed(2);
  const rows = [["Concepto", "Base", "Impuesto"]];
  for (const t of d.ventas) rows.push([`Total ventas a ${t.tarifa}%`, f(t.base), f(t.iva)]);
  rows.push(["Monto del impuesto ventas generales", "", f(d.ivaDebito)]);
  for (const t of d.compras) {
    rows.push([`Total importe compras a ${t.tarifa}%`, f(t.base), f(t.iva)]);
    rows.push([`Crédito fiscal por compras al ${t.tarifa}%`, "", f(t.credito)]);
    rows.push([`Gasto para utilidades por compras al ${t.tarifa}%`, "", f(t.gasto)]);
  }
  rows.push(["Tarifa de IVA aplicada", "", f(d.tarifaAplicada)]);
  rows.push(["Total impuesto soportado", "", f(d.ivaSoportado)]);
  rows.push(["Total crédito fiscal del periodo", "", f(d.creditoFiscal)]);
  rows.push(["Total gasto para utilidades", "", f(d.gastoParaUtilidades)]);
  rows.push(["Impuesto determinado", "", f(d.impuestoDeterminado)]);
  rows.push(["Retenciones registradas en el cierre", "", f(period.withholdings)]);
  rows.push(["Saldo después de retenciones", "", f(period.ivaNeto)]);
  if (d.requiereRevision) rows.push(["ATENCIÓN", "", "Ventas a más de una tarifa o sin ventas: el crédito necesita prorrata. Revisar con el contador."]);
  return rows;
}
