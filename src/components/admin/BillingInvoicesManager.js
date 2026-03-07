"use client";

import { useState, useTransition } from "react";

function toMoney(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function toDateInput(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getFeTone(feStatus) {
  switch (feStatus) {
    case "ACCEPTED":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    case "PENDING":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function BillingInvoicesManager({
  invoices = [],
  patients = [],
  professionals = [],
}) {
  const [rows, setRows] = useState(invoices);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const [draft, setDraft] = useState({
    contactId: patients[0]?.id || "",
    professionalId: "",
    invoiceType: "CUSTOMER_INVOICE",
    dueDate: toDateInput(new Date()),
    productName: "Servicios Profesionales",
    amount: "40000",
    taxRate: "13",
  });

  function updateRowInvoice(id, patch) {
    setRows((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  async function callApi(path, method = "POST", body) {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.message || "Error en operación de facturación.");
    return payload;
  }

  function handleCreateDraft() {
    setMessage("");
    startTransition(async () => {
      try {
        const amount = Number(draft.amount || 0);
        const taxRate = Number(draft.taxRate || 0);

        const payload = await callApi("/api/invoices", "POST", {
          invoiceType: draft.invoiceType,
          contactId: draft.contactId,
          professionalId: draft.professionalId || null,
          dueDate: draft.dueDate,
          lines: [
            {
              productName: draft.productName || "Ítem",
              quantity: 1,
              unitPrice: amount,
              discountPercent: 0,
              taxRate,
            },
          ],
        });

        setRows((current) => [payload, ...current]);
        setShowCreate(false);
        setMessage("Factura borrador creada.");
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function handleValidate(id) {
    setMessage("");
    startTransition(async () => {
      try {
        const payload = await callApi(`/api/invoices/${id}/validate`, "POST");
        updateRowInvoice(id, {
          invoiceNumber: payload.invoiceNumber,
          status: payload.status,
          balance: payload.balance,
        });
        setMessage("Factura validada.");
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function handlePay(id, currentBalance) {
    const amountStr = window.prompt("Monto a registrar (CRC):", String(currentBalance || 0));
    if (!amountStr) return;

    setMessage("");
    startTransition(async () => {
      try {
        const payload = await callApi(`/api/invoices/${id}/pay`, "POST", {
          amount: Number(amountStr),
        });
        updateRowInvoice(id, {
          status: payload.status,
          amountPaid: payload.amountPaid,
          balance: payload.balance,
        });
        setMessage("Pago registrado.");
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function handleCancel(id) {
    if (!window.confirm("¿Cancelar esta factura?")) return;

    setMessage("");
    startTransition(async () => {
      try {
        const payload = await callApi(`/api/invoices/${id}/cancel`, "POST");
        updateRowInvoice(id, { status: payload.status });
        setMessage("Factura cancelada.");
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function handleCreditNote(id) {
    const notes = window.prompt("Motivo de rectificativa:", "Rectificación administrativa");
    if (!notes) return;

    setMessage("");
    startTransition(async () => {
      try {
        await callApi(`/api/invoices/${id}/credit-note`, "POST", { notes });
        setMessage("Nota de crédito emitida.");
        window.location.reload();
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function handleSubmitFE(id) {
    setMessage("");
    startTransition(async () => {
      try {
        const payload = await callApi(`/api/invoices/${id}/submit-fe`, "POST");
        updateRowInvoice(id, {
          feStatus:      payload.feStatus,
          feNumber:      payload.feNumber,
          feClave:       payload.feClave,
          feErrorMessage: payload.feErrorMessage,
        });
        if (payload.feStatus === "ACCEPTED") {
          setMessage(`FE aceptada ✓ — Clave: ${payload.feClave}`);
        } else if (payload.feStatus === "REJECTED") {
          setMessage(`FE rechazada: ${payload.feErrorMessage || "Sin detalle"}`);
        } else {
          setMessage("Comprobante enviado. Estado: procesando.");
        }
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function handleRefreshFEStatus(id) {
    setMessage("");
    startTransition(async () => {
      try {
        const payload = await callApi(`/api/invoices/${id}/fe-status`, "GET");
        updateRowInvoice(id, {
          feStatus: payload.feStatus,
          feNumber: payload.feNumber,
          feClave: payload.feClave,
          feErrorMessage: payload.feErrorMessage,
        });
        setMessage(`Estado FE: ${payload.feStatus}${payload.feErrorMessage ? ` — ${payload.feErrorMessage}` : ""}`);
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showCreate ? "Cerrar creación" : "Nueva factura borrador"}
        </button>
        {message && <p className="text-sm text-slate-700">{message}</p>}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              value={draft.contactId}
              onChange={(e) => setDraft((s) => ({ ...s, contactId: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>

            <select
              value={draft.professionalId}
              onChange={(e) => setDraft((s) => ({ ...s, professionalId: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Sin profesional</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.user?.name || "Sin nombre"}
                </option>
              ))}
            </select>

            <select
              value={draft.invoiceType}
              onChange={(e) => setDraft((s) => ({ ...s, invoiceType: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="CUSTOMER_INVOICE">Factura cliente</option>
              <option value="SUPPLIER_INVOICE">Factura proveedor</option>
            </select>

            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setDraft((s) => ({ ...s, dueDate: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <input
              type="text"
              value={draft.productName}
              onChange={(e) => setDraft((s) => ({ ...s, productName: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Descripción"
            />
            <input
              type="number"
              value={draft.amount}
              onChange={(e) => setDraft((s) => ({ ...s, amount: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Monto"
            />
            <input
              type="number"
              value={draft.taxRate}
              onChange={(e) => setDraft((s) => ({ ...s, taxRate: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="IVA %"
            />
            <button
              onClick={handleCreateDraft}
              disabled={isPending || !draft.contactId}
              className="rounded-lg bg-accent-700 px-4 py-2 font-semibold text-white hover:bg-accent-800 disabled:opacity-60"
            >
              Crear borrador
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Número</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Contacto</th>
              <th className="px-4 py-2 text-left">Profesional</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Saldo</th>
              <th className="px-4 py-2 text-left">Estado</th>
              <th className="px-4 py-2 text-left">FE</th>
              <th className="px-4 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-semibold">{row.invoiceNumber}</td>
                <td className="px-4 py-2">{row.invoiceType}</td>
                <td className="px-4 py-2">{row.contactName || "Sin contacto"}</td>
                <td className="px-4 py-2">{row.professionalName || row.professional?.user?.name || "-"}</td>
                <td className="px-4 py-2 text-right">{toMoney(row.total)}</td>
                <td className="px-4 py-2 text-right">{toMoney(row.balance)}</td>
                <td className="px-4 py-2">{row.status}</td>
                <td className="px-4 py-2">
                  <div className="space-y-1">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${getFeTone(
                        row.feStatus
                      )}`}
                    >
                      {row.feStatus || "SIN_ENVIAR"}
                    </span>
                    {row.feNumber && <p className="text-xs text-slate-500">N: {row.feNumber}</p>}
                    {row.feClave && (
                      <p className="max-w-[240px] truncate text-xs text-slate-500">Clave: {row.feClave}</p>
                    )}
                    {row.feErrorMessage && (
                      <p className="max-w-[260px] text-xs text-red-600">{row.feErrorMessage}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.status === "DRAFT" && (
                      <button
                        onClick={() => handleValidate(row.id)}
                        disabled={isPending}
                        className="rounded bg-brand-600 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        Validar
                      </button>
                    )}
                    {row.status === "OPEN" && (
                      <button
                        onClick={() => handlePay(row.id, row.balance)}
                        disabled={isPending}
                        className="rounded bg-accent-700 px-2 py-1 text-xs font-semibold text-white hover:bg-accent-800"
                      >
                        Registrar pago
                      </button>
                    )}
                    {(row.status === "DRAFT" || row.status === "OPEN") && (
                      <button
                        onClick={() => handleCancel(row.id)}
                        disabled={isPending}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                    )}
                    {row.status === "PAID" && (
                      <button
                        onClick={() => handleCreditNote(row.id)}
                        disabled={isPending}
                        className="rounded bg-brand-700 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-800"
                      >
                        Nota crédito
                      </button>
                    )}
                    {(row.status === "OPEN" || row.status === "PAID") && row.feStatus !== "ACCEPTED" && (
                      <button
                        onClick={() => handleSubmitFE(row.id)}
                        disabled={isPending}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Enviar FE
                      </button>
                    )}
                    {row.feClave && row.feStatus !== "ACCEPTED" && (
                      <button
                        onClick={() => handleRefreshFEStatus(row.id)}
                        disabled={isPending}
                        className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        Consultar FE
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No hay facturas para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
