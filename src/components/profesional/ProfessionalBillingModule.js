"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { submitProfessionalInvoice } from "@/actions/professional-billing-actions";
import { useToast } from "@/components/ui/ToastProvider";

const TYPE_LABELS = {
  DEPOSIT_50: "Deposito 50%",
  BALANCE_50: "Saldo 50%",
  FULL_100: "Pago completo",
};

const STATUS_CONFIG = {
  APPROVED: { label: "Aprobado", style: "bg-emerald-100 text-emerald-700" },
  LINK_SENT: { label: "Enlace enviado", style: "bg-blue-100 text-blue-700" },
  PENDING: { label: "Pendiente", style: "bg-amber-100 text-amber-700" },
  REJECTED: { label: "Rechazado", style: "bg-red-100 text-red-700" },
  EXPIRED: { label: "Expirado", style: "bg-gray-100 text-gray-600" },
};

const INVOICE_STATUS = {
  DRAFT: { label: "Pendiente revision", style: "bg-amber-100 text-amber-700" },
  OPEN: { label: "Validada", style: "bg-blue-100 text-blue-700" },
  PAID: { label: "Pagada", style: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Cancelada", style: "bg-red-100 text-red-600" },
};

function fmt(amount) {
  return `₡${Number(amount).toLocaleString("es-CR")}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function filterByPeriod(transactions, period, customFrom, customTo) {
  const now = new Date();
  let from;
  let to;
  if (period === "today") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
    to = new Date(now);
    to.setHours(23, 59, 59, 999);
  } else if (period === "week") {
    from = new Date(now);
    from.setDate(now.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    to = new Date(now);
    to.setHours(23, 59, 59, 999);
  } else if (period === "month") {
    from = new Date(now);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    to = new Date(now);
    to.setHours(23, 59, 59, 999);
  } else if (period === "custom" && customFrom && customTo) {
    from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
  } else {
    return transactions;
  }
  return transactions.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= from && d <= to;
  });
}

export default function ProfessionalBillingModule({
  transactions,
  submittedInvoices,
  settlements = [],
  rangeFrom,
  rangeTo,
}) {
  const router = useRouter();
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isPending, startTransition] = useTransition();
  const { avisar } = useToast();

  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [xmlUrl, setXmlUrl] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);
  const [readingXml, setReadingXml] = useState(false);
  const xmlRequest = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);
  const settlement = settlements.find((item) => item.id === selectedSettlement);
  const settlementMismatch = Boolean(invoiceData && settlement && Math.abs(invoiceData.amount - Number(settlement.netAmount)) > 0.005);

  const filtered = useMemo(
    () => filterByPeriod(transactions, period, customFrom, customTo),
    [transactions, period, customFrom, customTo]
  );

  const totalApproved = useMemo(
    () => filtered.filter((t) => t.status === "APPROVED").reduce((s, t) => s + t.amount, 0),
    [filtered]
  );
  const totalPending = useMemo(
    () =>
      filtered
        .filter((t) => t.status === "PENDING" || t.status === "LINK_SENT")
        .reduce((s, t) => s + t.amount, 0),
    [filtered]
  );

  function applyCustomRange() {
    if (!customFrom || !customTo) return;
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("from", customFrom);
      params.set("to", customTo);
      router.push(`/panel/profesional/contabilidad?${params.toString()}`);
      setPeriod("custom");
    });
  }

  async function handleXmlChange(e) {
    const file = e.target.files?.[0];
    const requestId = ++xmlRequest.current;
    setInvoiceData(null);
    setXmlUrl("");
    setSubmitMsg(null);
    setReadingXml(false);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setSubmitMsg({ ok: false, text: "El XML no puede pesar más de 5MB." });
      return;
    }
    setReadingXml(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/professional-invoice", { method: "POST", body: fd });
      const data = await res.json();
      if (requestId !== xmlRequest.current) return;
      if (!res.ok || !data.url || !data.invoiceData) throw new Error(data.error || "No se pudo leer el XML.");
      setXmlUrl(data.url);
      setInvoiceData(data.invoiceData);
    } catch (err) {
      if (requestId === xmlRequest.current) setSubmitMsg({ ok: false, text: err.message || "No se pudo leer el XML." });
    } finally {
      if (requestId === xmlRequest.current) setReadingXml(false);
    }
  }

  async function handleSubmitInvoice(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (uploading || readingXml) return;
    setSubmitMsg(null);

    if (!pdfFile) {
      setSubmitMsg({ ok: false, text: "Seleccione el PDF de la factura." });
      return;
    }
    if (!xmlUrl || !invoiceData) {
      setSubmitMsg({ ok: false, text: "Seleccione el XML firmado de la factura." });
      return;
    }
    if (settlementMismatch) return;

    setUploading(true);
    let fileUrl = "";
    try {
      const fd = new FormData();
      fd.append("file", pdfFile);
      const res = await fetch("/api/upload/professional-invoice", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Error al subir el archivo.");
      fileUrl = data.url;
    } catch (err) {
      setSubmitMsg({ ok: false, text: err.message });
      setUploading(false);
      return;
    }

    const periodStart = period === "custom" ? customFrom : null;
    const periodEnd = period === "custom" ? customTo : null;

    try {
      const result = await submitProfessionalInvoice({
        fileUrl,
        xmlUrl,
        periodStart,
        periodEnd,
        settlementId: selectedSettlement,
      });
      if (result.success) {
        setSubmitMsg({
          ok: true,
          text: "Factura presentada correctamente. El admin la revisara pronto.",
        });
        setSelectedSettlement(null);
        setPdfFile(null);
        setXmlUrl("");
        setInvoiceData(null);
        form.reset();
        router.refresh();
      } else {
        setSubmitMsg({
          ok: false,
          text: result.error || "Error al presentar la factura.",
        });
      }
    } catch (fallo) {
      // Antes esto se perdía como promesa rechazada: ni mensaje ni cambio.
      const mensaje = String(fallo?.message || "").trim() || "No se pudo completar la acción.";
      setSubmitMsg({ ok: false, text: mensaje });
      avisar(mensaje, "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {[
              { key: "today", label: "Hoy" },
              { key: "week", label: "Esta semana" },
              { key: "month", label: "Este mes" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                  period === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
            <button
              onClick={applyCustomRange}
              disabled={!customFrom || !customTo || isPending}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { label: "Total cobrado", value: fmt(totalApproved), accent: "text-emerald-600" },
          { label: "Pendiente de cobro", value: fmt(totalPending), accent: "text-amber-600" },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Liquidaciones</h2>
        <div className="mt-3 space-y-3">
          {settlements.length ? settlements.map((settlement) => (
            <div key={settlement.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap justify-between gap-2"><span>{fmtDate(settlement.periodStart)} - {fmtDate(settlement.periodEnd)}</span><span className="font-semibold">{settlement.status}</span></div>
              <p className="mt-2 text-sm text-slate-600">Bruto {fmt(settlement.grossAmount)} · Comisión {fmt(settlement.commissionAmt)} · ONVO {fmt(settlement.processingFeeAmt)} · <strong>Neto {fmt(settlement.netAmount)}</strong></p>
              <p className="mt-1 text-xs text-slate-500">{settlement.items.length} cobro(s). La presentación de la factura se valida contra este neto exacto.</p>
              <details className="mt-2 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold text-slate-700">Ver cálculo por consulta</summary>
                <div className="mt-2 space-y-1">
                  {settlement.items.map((item) => (
                    <p key={item.id}>
                      {fmtDate(item.date)} · {item.patientName} · Consulta {item.consultationNumber || "legado"} · {TYPE_LABELS[item.paymentType] || item.paymentType} · {item.commissionPct}% = {fmt(item.commissionAmt)}
                    </p>
                  ))}
                </div>
              </details>
              {settlement.status === "OPEN" ? <button type="button" disabled={uploading} onClick={() => { setSelectedSettlement(settlement.id); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Presentar factura por {fmt(settlement.netAmount)}</button> : null}
            </div>
          )) : <p className="text-sm text-slate-500">Todavía no hay liquidaciones generadas.</p>}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Cobros del periodo</h2>
          <p className="text-sm text-slate-500">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            Sin cobros en este periodo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Paciente</th>
                  <th className="px-6 py-3">Servicio</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const s = STATUS_CONFIG[t.status] || {
                    label: t.status,
                    style: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-slate-600">{fmtDate(t.createdAt)}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">{t.patientName}</td>
                      <td className="px-6 py-4 text-slate-600">{t.serviceTitle}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {TYPE_LABELS[t.type] || t.type}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-800">
                        {fmt(t.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${s.style}`}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Presentar factura</h2>
          <p className="text-sm text-slate-500">
            Seleccione el XML para completar automáticamente los datos de la factura y revíselos antes de presentarla.
          </p>
        </div>

        <form onSubmit={handleSubmitInvoice} className="space-y-4 p-6">
          <div>
            <label htmlFor="invoice-xml" className="mb-1 block text-sm font-medium text-slate-700">XML firmado de la factura *</label>
            <input id="invoice-xml" type="file" accept=".xml,application/xml,text/xml" onChange={handleXmlChange} disabled={uploading} required className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
            <p role="status" className="mt-1 text-xs text-slate-500">{readingXml ? "Leyendo datos del XML..." : invoiceData ? "Datos extraídos del XML. Para cambiarlos, seleccione otro archivo." : "Máximo 5MB. La factura se presenta al pulsar el botón al final."}</p>
          </div>
          {settlement ? <p className="text-sm text-slate-600">Liquidación seleccionada: <strong>{fmt(settlement.netAmount)}</strong>. <button type="button" disabled={uploading} onClick={() => setSelectedSettlement(null)} className="text-blue-700 underline">Quitar selección</button></p> : null}
          {settlementMismatch ? <p role="alert" className="text-sm text-red-700">El total del XML ({fmt(invoiceData.amount)}) no coincide con el neto de la liquidación ({fmt(settlement.netAmount)}). Seleccione la factura o la liquidación correspondiente.</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="invoice-reference" className="mb-1 block text-sm font-medium text-slate-700">
                N° de factura *
              </label>
              <input
                id="invoice-reference"
                type="text"
                value={invoiceData?.referenceNumber || ""}
                readOnly
                placeholder="Se extrae del XML"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="invoice-clave" className="mb-1 block text-sm font-medium text-slate-700">Clave numérica FE (50 dígitos) *</label>
              <input id="invoice-clave" type="text" value={invoiceData?.supplierFeClave || ""} readOnly placeholder="Se extrae del XML" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label htmlFor="invoice-amount" className="mb-1 block text-sm font-medium text-slate-700">
                Monto a facturar (₡) *
                <span className="ml-1 text-xs font-normal text-slate-400">
                  total del XML, IVA incluido
                </span>
              </label>
              <input
                id="invoice-amount"
                type="number"
                value={invoiceData?.amount ?? ""}
                readOnly
                step="0.01"
                min="0.01"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {invoiceData ? <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
            {[
              ["Emisor", invoiceData.supplierName], ["Identificación del emisor", invoiceData.supplierIdNumber],
              ["Fecha de emisión", new Date(invoiceData.invoiceDate).toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica" })], ["Moneda", invoiceData.currency],
              ["Base después de descuentos", fmt(invoiceData.subtotal)], ["Impuestos", fmt(invoiceData.taxAmount)],
              ["Descuentos", fmt(invoiceData.discountAmount)],
            ].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-800">{value}</dd></div>)}
          </dl> : null}

          <div>
            <label htmlFor="invoice-pdf" className="mb-1 block text-sm font-medium text-slate-700">
              PDF de factura *
            </label>
            <input
              id="invoice-pdf"
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              disabled={uploading}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
            <p className="mt-1 text-xs text-slate-400">Solo PDF, maximo 5MB.</p>
          </div>

          {submitMsg ? (
            <div
              role="status"
              className={`rounded-xl border px-4 py-3 text-sm ${
                submitMsg.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {submitMsg.text}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={uploading || readingXml || !invoiceData || !pdfFile || settlementMismatch}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {readingXml ? "Leyendo XML..." : uploading ? "Presentando factura..." : "Presentar factura"}
          </button>
        </form>
      </div>

      {submittedInvoices.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Facturas presentadas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">N° factura</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submittedInvoices.map((inv) => {
                  const s = INVOICE_STATUS[inv.status] || {
                    label: inv.status,
                    style: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-slate-600">{fmtDate(inv.invoiceDate)}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {inv.supplierReference || "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-800">
                        {fmt(inv.total)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${s.style}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {inv.pdfUrl ? (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline hover:text-blue-800"
                          >
                            Ver PDF
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
