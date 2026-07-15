import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { closeFiscalPeriod, fileFiscalPeriod } from "@/actions/fiscal-actions";

export const dynamic = "force-dynamic";

export default async function FiscalClosingPage({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  const now = new Date();
  const year = Number(searchParams?.year || now.getFullYear());
  const month = Number(searchParams?.month || now.getMonth() + 1);
  const period = await prisma.fiscalPeriod.findUnique({ where: { year_month: { year, month } } });
  const label = `${year}-${String(month).padStart(2, "0")}`;
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div><a href="/panel/admin/contabilidad" className="text-sm text-slate-500">Volver a contabilidad</a><h1 className="mt-2 text-3xl font-bold text-slate-900">Cierre fiscal</h1><p className="text-slate-600">Recolección interna para D-104. La presentación ante Hacienda sigue siendo manual.</p></div>
      <form className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4"><input name="year" type="number" defaultValue={year} className="rounded-lg border px-3 py-2" /><select name="month" defaultValue={month} className="rounded-lg border px-3 py-2">{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select><button className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">Consultar</button></form>
      <section className="grid gap-4 md:grid-cols-4">
        {[['IVA débito', period?.ivaDebito], ['IVA crédito', period?.ivaCredito], ['IVA neto', period?.ivaNeto], ['Estado', period?.status || 'OPEN']].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{typeof value === 'number' || value?.toString?.().includes('.') ? `₡${Number(value || 0).toLocaleString('es-CR')}` : value}</p></div>)}
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <form action={closeFiscalPeriod} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Cerrar período</h2><input type="hidden" name="year" value={year} /><input type="hidden" name="month" value={month} /><label className="block text-sm">Retenciones<input name="withholdings" type="number" step="0.01" defaultValue={Number(period?.withholdings || 0)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><button className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white">Congelar números</button></form>
        <form action={fileFiscalPeriod} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Marcar como presentado</h2><input type="hidden" name="year" value={year} /><input type="hidden" name="month" value={month} /><input name="filedReceipt" placeholder="Comprobante TRIBU-CR" required className="w-full rounded-lg border px-3 py-2" /><button className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Guardar presentación</button></form>
      </section>
      <div className="flex flex-wrap gap-3"><a href={`/api/admin/fiscal-export?year=${year}&month=${month}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Exportar CSV D-104</a></div>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Checklist de obligaciones</h2><div className="mt-3 grid gap-2 md:grid-cols-2">{[
        ["D-104", 15, period?.status === "FILED"], ["Pagos parciales de renta", 0, false], ["D-101", 0, false], ["RTBF", 0, false], ["Impuesto a personas jurídicas", 0, false], ["Timbre educación y cultura", 0, false],
      ].map(([name, dueDay, done]) => <div key={name} className={`rounded-lg border px-3 py-2 text-sm ${done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}><span className="font-semibold">{done ? "✓" : "○"} {name}</span>{dueDay ? <span className="ml-2">vence día {dueDay}</span> : <span className="ml-2">seguimiento manual</span>}</div>)}</div></section>
      <p className="text-sm text-slate-500">Período seleccionado: {label}. Las casillas exactas de la D-104 quedan pendientes de validación con el contador.</p>
    </main>
  );
}
