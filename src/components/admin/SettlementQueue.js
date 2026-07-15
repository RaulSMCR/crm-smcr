export default function SettlementQueue({ settlements = [] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-800">Por pagar a profesionales</h2>
      <div className="mt-3 space-y-2">
        {settlements.length ? settlements.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm">
            <span>{row.professional?.user?.name || "Profesional"} · {new Date(row.periodStart).toLocaleDateString("es-CR")} - {new Date(row.periodEnd).toLocaleDateString("es-CR")}</span>
            <span className="font-semibold">₡{Number(row.netAmount).toLocaleString("es-CR")}</span>
            <span className="text-slate-500">ONVO ₡{Number(row.processingFeeAmt || 0).toLocaleString("es-CR")} · Factura: {row.invoice?.invoiceNumber || "sin factura"}</span>
          </div>
        )) : <p className="text-sm text-slate-500">No hay liquidaciones pendientes de pago.</p>}
      </div>
    </section>
  );
}
