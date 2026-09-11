"use client";
import { useCallback, useEffect, useState } from "react";

const labels = { PAYMENT_CONFIRMATION: "Confirmación del pago", FE_SUBMISSION: "Trámite en Hacienda", FE_RECEIPT: "Entrega de factura" };
const statuses = { PENDING: "Pendiente", PROCESSING: "En proceso", REVIEW: "Requiere revisión" };

export default function PaymentDeliveriesPanel() {
  const [jobs, setJobs] = useState(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/payment-deliveries");
    if (!response.ok) throw new Error("No se pudieron consultar los envíos.");
    setJobs((await response.json()).jobs);
  }, []);
  useEffect(() => { refresh().catch((error) => setMessage(error.message)); }, [refresh]);
  async function process(retryJobId) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/payment-deliveries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(retryJobId ? { retryJobId } : {}) });
      if (!response.ok) throw new Error("No se pudo procesar la cola. Las tareas se conservan.");
      const result = await response.json();
      await refresh();
      setMessage(`Se procesaron ${result.processed} tareas. Los próximos reintentos respetan su tiempo de espera.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border bg-white p-4" aria-labelledby="deliveries-title">
    <h2 id="deliveries-title" className="font-bold">Correos y facturas pendientes</h2>
    <p className="text-sm text-slate-600">Los pagos se conservan aunque una entrega falle. Las tareas que requieren revisión no se reenvían automáticamente.</p>
    <button type="button" onClick={() => process()} disabled={busy} className="rounded-lg bg-slate-800 px-4 py-2 text-white disabled:opacity-50">{busy ? "Procesando…" : "Procesar tareas pendientes"}</button>
    <p role="status" className="text-sm">{message}</p>
    {jobs === null ? <p className="text-sm text-slate-500">{message ? "Lista de envíos no disponible." : "Consultando envíos…"}</p> : jobs.length === 0 ? <p className="text-sm text-slate-500">No hay tareas pendientes en esta consulta.</p> : <ul className="space-y-2">
      {jobs.map((job) => <li key={job.id} className="rounded-lg border p-3 text-sm">
        <p className="font-semibold">Factura {job.invoice.invoiceNumber} · {labels[job.kind]}</p>
        <p>{statuses[job.status]} · Intentos: {job.attempts}</p>
        {job.status === "REVIEW" && <p className="mt-1 text-amber-800">Compruebe el resultado en Resend o Hacienda antes de reenviar. Referencia: {job.lastErrorCode}.</p>}
        {job.status === "REVIEW" && (job.kind === "FE_SUBMISSION" || !job.firstSendAt) && <button type="button" disabled={busy} onClick={() => process(job.id)} className="mt-2 rounded border px-3 py-1 disabled:opacity-50">Reintentar tras corregir la causa</button>}
      </li>)}
    </ul>}
  </section>;
}
