"use client";
import { useEffect, useState } from "react";

export default function ReconciliationPanel() {
  const [data, setData] = useState(null);
  const [received, setReceived] = useState("");
  useEffect(() => { fetch("/api/admin/reconciliation").then((r) => r.json()).then(setData); }, []);
  if (!data) return <p className="text-sm text-slate-500">Cargando conciliación...</p>;
  const commission = Number(data.summary?.gross || 0) * 0.045;
  const expected = Number(data.summary?.gross || 0) - commission;
  const difference = received === "" ? null : Number(received) - expected;
  return <div className="space-y-5">
    <div className="grid gap-4 md:grid-cols-4">{[["Pagos aprobados", data.summary.approvedCount], ["Bruto", `₡${data.summary.gross.toLocaleString("es-CR")}`], ["Comisión estimada (4.5%)", `₡${commission.toLocaleString("es-CR")}`], ["Depósito esperado", `₡${expected.toLocaleString("es-CR")}`]].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>
    <div className="rounded-xl border bg-white p-4"><label className="text-sm font-semibold">Depósito recibido<input value={received} onChange={(e) => setReceived(e.target.value)} type="number" step="0.01" className="ml-3 rounded-lg border px-3 py-2" /></label>{difference !== null ? <p className={`mt-3 font-semibold ${Math.abs(difference) < 0.01 ? "text-emerald-700" : "text-red-700"}`}>Diferencia: ₡{difference.toLocaleString("es-CR")}</p> : null}</div>
    <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border bg-white p-4"><h2 className="font-bold">Pagos sin factura ({data.paymentsWithoutInvoice.length})</h2>{data.paymentsWithoutInvoice.map((row) => <p key={row.id} className="mt-2 text-sm">{row.appointment?.patient?.name || "Paciente"} · ₡{Number(row.amount).toLocaleString("es-CR")}</p>)}</div><div className="rounded-xl border bg-white p-4"><h2 className="font-bold">Facturas sin pago ({data.invoicesWithoutPayment.length})</h2>{data.invoicesWithoutPayment.map((row) => <p key={row.id} className="mt-2 text-sm">{row.invoiceNumber} · ₡{Number(row.total).toLocaleString("es-CR")}</p>)}</div></div>
    <div className="rounded-xl border bg-white p-4"><h2 className="font-bold">Eventos no conciliados ({data.unmatched.length})</h2>{data.unmatched.map((row) => <p key={row.id} className="mt-2 text-sm">{row.reason} · ₡{Number(row.amount || 0).toLocaleString("es-CR")}</p>)}</div>
  </div>;
}
