"use client";

import { useCallback, useState, useTransition } from "react";
import Toast from "@/components/ui/Toast";
import { computeInvoiceLine, splitTaxIncluded } from "@/lib/invoice-math";
import { MOTIVO_DESCUENTO_MAX, problemaDeDescuento } from "@/lib/invoice-draft-lines";
import { updateSupplierInvoiceAcceptance } from "@/actions/professional-billing-actions";
import { accionesFe, estadoFeVisible } from "@/lib/fe/estado-visible";

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

const colones = (valor) =>
  new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 2 }).format(valor);

/**
 * La línea que se va a emitir a partir de lo que se escribió.
 *
 * El monto es el precio con el IVA dentro —lo que se le cobra al paciente—,
 * pero una línea de factura se expresa ANTES de impuesto. Se separa con la misma
 * aritmética que usa el webhook de pagos, para que facturar a mano una consulta
 * dé exactamente lo mismo que cobrarla, y el descuento se aplica sobre esa base,
 * que es como lo calcula el servidor (computeInvoiceLine).
 */
function lineaDesdeBorrador({ amount, taxRate, discountPercent }) {
  const precio = Number(amount || 0);
  const tasa = Number(taxRate || 0);
  if (!Number.isFinite(precio) || precio <= 0 || !Number.isFinite(tasa) || tasa < 0) return null;
  const { baseCents } = splitTaxIncluded(Math.round(precio * 100), tasa);
  const pct = Number(discountPercent || 0);
  const linea = computeInvoiceLine({
    quantity: 1,
    unitPrice: baseCents / 100,
    discountPercent: Number.isFinite(pct) ? pct : 0,
    taxRate: tasa,
  });
  return { ...linea, precio, descuento: Math.round((linea.unitPrice - linea.lineSubtotal) * 100) / 100 };
}

/** Lo que se va a emitir, antes de emitirlo. */
function DesgloseFactura({ linea, motivo }) {
  if (!linea) return null;
  return (
    <div className="mt-3 max-w-md rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt>Precio unitario (sin IVA)</dt>
        <dd className="text-right">{colones(linea.unitPrice)}</dd>
        {linea.descuento > 0 && (
          <>
            <dt>
              Descuento {linea.discountPercent}%
              {motivo ? <span className="block text-xs text-slate-500">{motivo}</span> : null}
            </dt>
            <dd className="text-right">−{colones(linea.descuento)}</dd>
          </>
        )}
        <dt>Subtotal</dt>
        <dd className="text-right">{colones(linea.lineSubtotal)}</dd>
        <dt>IVA {linea.taxRate}%</dt>
        <dd className="text-right">{colones(linea.taxAmount)}</dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold">{colones(linea.lineTotal)}</dd>
      </dl>
    </div>
  );
}

export default function BillingInvoicesManager({
  invoices = [],
  patients = [],
  professionals = [],
  services = [],
}) {
  const [rows, setRows] = useState(invoices);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const [isPending, startTransition] = useTransition();

  const [draft, setDraft] = useState({
    contactId: patients[0]?.id || "",
    professionalId: "",
    invoiceType: "CUSTOMER_INVOICE",
    dueDate: toDateInput(new Date()),
    // El servicio aporta el CABYS y el impuesto de la línea. Solo se ofrecen los
    // que tienen los dos: sin CABYS, Hacienda rechaza la factura.
    serviceId: services[0]?.id || "",
    productName: "Servicios Profesionales",
    description: "",
    amount: "40000",
    discountPercent: "",
    discountReason: "",
  });

  const servicio = services.find((s) => s.id === draft.serviceId) || null;
  const lineaBorrador = lineaDesdeBorrador({
    amount: draft.amount,
    taxRate: servicio?.taxRate ?? 0,
    discountPercent: draft.discountPercent,
  });
  const problemaDescuento = problemaDeDescuento({
    discountPercent: draft.discountPercent,
    discountType: draft.discountReason,
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
    setToast(null);
    startTransition(async () => {
      try {
        if (!servicio) throw new Error("Elija el servicio: de ahí salen el CABYS y el impuesto.");
        if (!lineaBorrador) throw new Error("Indique el monto cobrado, con el IVA incluido.");
        if (problemaDescuento) throw new Error(problemaDescuento);

        // El impuesto y el CABYS los pone el servidor a partir del servicio; la
        // tasa viaja solo para que el cálculo de la línea sea el mismo.
        const payload = await callApi("/api/invoices", "POST", {
          invoiceType: draft.invoiceType,
          contactId: draft.contactId,
          professionalId: draft.professionalId || null,
          dueDate: draft.dueDate,
          lines: [
            {
              serviceId: servicio.id,
              productName: draft.productName || "Ítem",
              description: draft.description.trim() || null,
              quantity: 1,
              unitPrice: lineaBorrador.unitPrice,
              discountPercent: lineaBorrador.discountPercent,
              discountType: lineaBorrador.discountPercent > 0 ? draft.discountReason : null,
              taxRate: lineaBorrador.taxRate,
            },
          ],
        });

        setRows((current) => [payload, ...current]);
        setShowCreate(false);
        setToast({ message: "Factura borrador creada.", type: "success" });
      } catch (error) {
        setToast({ message: error.message, type: "error" });
      }
    });
  }

  function handleValidate(id) {
    setToast(null);
    startTransition(async () => {
      try {
        const payload = await callApi(`/api/invoices/${id}/validate`, "POST");
        updateRowInvoice(id, {
          invoiceNumber: payload.invoiceNumber,
          status: payload.status,
          balance: payload.balance,
        });
        setToast({ message: "Factura validada correctamente.", type: "success" });
      } catch (error) {
        setToast({ message: error.message, type: "error" });
      }
    });
  }

  function handlePay(id, currentBalance) {
    const amountStr = window.prompt("Monto a registrar (CRC):", String(currentBalance || 0));
    if (!amountStr) return;

    setToast(null);
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
        setToast({ message: "Pago registrado correctamente.", type: "success" });
      } catch (error) {
        setToast({ message: error.message, type: "error" });
      }
    });
  }

  function handleCancel(id) {
    if (!window.confirm("¿Cancelar esta factura?")) return;

    setToast(null);
    startTransition(async () => {
      try {
        const payload = await callApi(`/api/invoices/${id}/cancel`, "POST");
        updateRowInvoice(id, { status: payload.status });
        setToast({ message: "Factura cancelada.", type: "success" });
      } catch (error) {
        setToast({ message: error.message, type: "error" });
      }
    });
  }

  function handleReissue(row) {
    const confirmado = window.confirm(
      `Hacienda rechazó la factura ${row.invoiceNumber}. Su clave es definitiva: reenviarla ` +
        "devuelve siempre el mismo rechazo.\n\n" +
        "Reemitir la anula internamente y crea una factura nueva en borrador, con el mismo " +
        "pago y la misma cita. No lleva nota de crédito, porque nunca fue aceptada.\n\n" +
        "Después hay que validar la nueva (toma el próximo consecutivo) y enviarla.\n\n¿Reemitir?",
    );
    if (!confirmado) return;

    setToast(null);
    startTransition(async () => {
      try {
        const payload = await callApi(`/api/invoices/${row.id}/reissue`, "POST");
        updateRowInvoice(row.id, { status: payload.original.status });
        setRows((current) =>
          current.some((item) => item.id === payload.reemision.id)
            ? current
            : [{ ...payload.reemision, professionalName: row.professionalName }, ...current],
        );
        setToast({
          message: payload.yaExistia
            ? `Esta factura ya se había reemitido (${payload.reemision.invoiceNumber}).`
            : "Reemisión creada en borrador. Validala para asignarle el consecutivo y después enviala.",
          type: "success",
        });
      } catch (error) {
        setToast({ message: error.message, type: "error" });
      }
    });
  }

  function handleCreditNote(id) {
    const notes = window.prompt("Motivo de rectificativa:", "Rectificación administrativa");
    if (!notes) return;

    setToast(null);
    startTransition(async () => {
      try {
        await callApi(`/api/invoices/${id}/credit-note`, "POST", { notes });
        setToast({ message: "Nota de crédito emitida.", type: "success" });
        window.location.reload();
      } catch (error) {
        setToast({ message: error.message, type: "error" });
      }
    });
  }

  function handleSubmitFE(id) {
    setToast(null);
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
          setToast({ message: `FE aceptada — Clave: ${payload.feClave}`, type: "success" });
        } else if (payload.feStatus === "REJECTED") {
          setToast({ message: `FE rechazada: ${payload.feErrorMessage || "Sin detalle"}`, type: "error" });
        } else {
          setToast({ message: "Comprobante enviado. Estado: procesando.", type: "success" });
        }
      } catch (error) {
        setToast({ message: error.message, type: "error" });
      }
    });
  }

  function handleRefreshFEStatus(id) {
    setToast(null);
    startTransition(async () => {
      try {
        const payload = await callApi(`/api/invoices/${id}/fe-status`, "GET");
        updateRowInvoice(id, {
          feStatus: payload.feStatus,
          feNumber: payload.feNumber,
          feClave: payload.feClave,
          feErrorMessage: payload.feErrorMessage,
        });
        setToast({ message: `Estado FE: ${payload.feStatus}${payload.feErrorMessage ? ` — ${payload.feErrorMessage}` : ""}`, type: payload.feStatus === "REJECTED" ? "error" : "success" });
      } catch (error) {
        setToast({ message: error.message, type: "error" });
      }
    });
  }

  function handleAcceptance(id, acceptanceStatus) {
    startTransition(async () => {
      // Era el único manejador de este panel sin try/catch; el resto ya lo tenía.
      try {
        const result = await updateSupplierInvoiceAcceptance(id, acceptanceStatus);
        if (!result.success) setToast({ message: result.error, type: "error" });
        else {
          updateRowInvoice(id, { acceptanceStatus, acceptanceAt: new Date().toISOString() });
          setToast({ message: `Factura marcada como ${acceptanceStatus === "ACCEPTED" ? "aceptada" : "rechazada"}.`, type: "success" });
        }
      } catch (error) {
        setToast({ message: error?.message || "No se pudo registrar la aceptación.", type: "error" });
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
            <label className="text-xs text-slate-600">
              Servicio (CABYS e IVA)
              <select
                value={draft.serviceId}
                onChange={(e) => setDraft((s) => ({ ...s, serviceId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {services.length === 0 && <option value="">Ningún servicio tiene CABYS e impuesto</option>}
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · CABYS {s.cabysCode} · IVA {s.taxRate}%
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Nombre de la línea
              <input
                type="text"
                value={draft.productName}
                onChange={(e) => setDraft((s) => ({ ...s, productName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-xs text-slate-600">
              Detalle (opcional)
              <input
                type="text"
                value={draft.description}
                onChange={(e) => setDraft((s) => ({ ...s, description: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Ej.: sesión del 15/10/2026"
              />
            </label>
            <label className="text-xs text-slate-600">
              Monto cobrado (IVA incluido)
              <input
                type="number"
                min="0"
                value={draft.amount}
                onChange={(e) => setDraft((s) => ({ ...s, amount: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>
          </div>

          {/* El descuento es posible pero no mudo: sin motivo no se crea, y el
              motivo es lo que Hacienda recibe como NaturalezaDescuento. */}
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <label className="text-xs text-slate-600">
              Descuento % (opcional)
              <input
                type="number"
                min="0"
                max="99.99"
                step="0.01"
                value={draft.discountPercent}
                onChange={(e) => setDraft((s) => ({ ...s, discountPercent: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="0"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              Motivo del descuento {Number(draft.discountPercent) > 0 ? "(obligatorio)" : ""}
              <input
                type="text"
                maxLength={MOTIVO_DESCUENTO_MAX}
                value={draft.discountReason}
                onChange={(e) => setDraft((s) => ({ ...s, discountReason: e.target.value }))}
                disabled={!(Number(draft.discountPercent) > 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                placeholder="Ej.: tarifa social acordada con el paciente"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Va en el comprobante como naturaleza del descuento. Se aplica sobre el precio sin IVA.
              </span>
            </label>
            <div className="flex items-end">
              <button
                onClick={handleCreateDraft}
                disabled={isPending || !draft.contactId || !servicio || !lineaBorrador || Boolean(problemaDescuento)}
                className="w-full rounded-lg bg-accent-700 px-4 py-2 font-semibold text-white hover:bg-accent-800 disabled:opacity-60"
              >
                Crear borrador
              </button>
            </div>
          </div>

          {problemaDescuento && <p className="mt-2 text-sm text-red-700">{problemaDescuento}</p>}

          {/* Lo que se va a emitir, antes de emitirlo, con la misma cuenta que
              hace el servidor. */}
          <DesgloseFactura
            linea={lineaBorrador}
            motivo={Number(draft.discountPercent) > 0 ? draft.discountReason.trim() : ""}
          />
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
              <th className="px-4 py-2 text-left">Mensaje receptor</th>
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
                  {row.invoiceType === "SUPPLIER_INVOICE" ? (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold">{row.acceptanceStatus || "PENDING"}</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleAcceptance(row.id, "ACCEPTED")} disabled={isPending} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Aceptar</button>
                        <button onClick={() => handleAcceptance(row.id, "REJECTED")} disabled={isPending} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Rechazar</button>
                      </div>
                    </div>
                  ) : "-"}
                </td>
                <td className="px-4 py-2">
                  <div className="space-y-1">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${getFeTone(
                        estadoFeVisible(row)
                      )}`}
                    >
                      {estadoFeVisible(row)}
                    </span>
                    {row.feNumber && <p className="text-xs text-slate-500">N: {row.feNumber}</p>}
                    {row.feClave && (
                      <p className="max-w-[240px] truncate text-xs text-slate-500" title={row.feClave}>
                        Clave: {row.feClave}
                      </p>
                    )}
                    {/* El detalle completo, sin recortar: es lo que dice qué
                        corregir. Antes el rechazo solo se veía en la sesión en
                        que se apretó «Consultar FE». */}
                    {row.feErrorMessage && (
                      <p className="max-w-[260px] whitespace-pre-line break-words text-xs text-red-600">
                        {estadoFeVisible(row) === "REJECTED" && (
                          <span className="font-semibold">Motivo de Hacienda: </span>
                        )}
                        {row.feErrorMessage}
                      </p>
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
                    {accionesFe(row).notaCredito && (
                      <button
                        onClick={() => handleCreditNote(row.id)}
                        disabled={isPending}
                        className="rounded bg-brand-700 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-800"
                      >
                        Nota crédito
                      </button>
                    )}
                    {accionesFe(row).reemitir && (
                      <button
                        onClick={() => handleReissue(row)}
                        disabled={isPending}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Reemitir
                      </button>
                    )}
                    {accionesFe(row).enviar && (
                      <button
                        onClick={() => handleSubmitFE(row.id)}
                        disabled={isPending}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Enviar FE
                      </button>
                    )}
                    {accionesFe(row).consultar && (
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
      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </div>
  );
}
