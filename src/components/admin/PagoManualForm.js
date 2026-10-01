"use client";

// src/components/admin/PagoManualForm.js
//
// Reportar un pago recibido fuera de ONVO para que se facture.
//
// No usa `useAccionServidor` porque esto no tiene dos desenlaces sino tres, y el
// del medio es el que importa: la factura puede quedar emitida y Hacienda no
// haberla aceptado. Un toast verde ahí sería mentira —el cliente no recibió
// ningún comprobante— y uno rojo haría pensar que no se emitió nada, cuando el
// consecutivo ya se consumió. Cada caso se avisa con lo que de verdad pasó.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

const TIPOS_DE_COBRO = [
  { valor: "FULL_100", etiqueta: "Pago completo" },
  { valor: "DEPOSIT_50", etiqueta: "Adelanto 50%" },
  { valor: "BALANCE_50", etiqueta: "Saldo 50%" },
  { valor: "PENALTY_50", etiqueta: "Cargo por cancelación tardía" },
];

/** "2026-10-01T13:05", que es lo que espera un input datetime-local. */
function ahoraParaInput() {
  const ahora = new Date();
  const desfase = ahora.getTimezoneOffset() * 60_000;
  return new Date(ahora.getTime() - desfase).toISOString().slice(0, 16);
}

function colones(valor) {
  return `₡${Number(valor || 0).toLocaleString("es-CR")}`;
}

const ETIQUETA_ESTADO_PAGO = { UNPAID: "sin pagar", PARTIALLY_PAID: "parcialmente pagada" };

export default function PagoManualForm({ citas = [], clientes = [], servicios = [], cuentas = [] }) {
  const router = useRouter();
  const { avisar } = useToast();

  const [modo, setModo] = useState("cita");
  const [enviando, setEnviando] = useState(false);
  const [citaId, setCitaId] = useState("");
  const [tipo, setTipo] = useState("FULL_100");
  const [contactId, setContactId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [cuenta, setCuenta] = useState(cuentas[0]?.codigo || "");
  const [referencia, setReferencia] = useState("");
  const [fechaPago, setFechaPago] = useState(ahoraParaInput);

  const cita = useMemo(() => citas.find((c) => c.id === citaId) || null, [citas, citaId]);
  const cliente = useMemo(() => clientes.find((c) => c.id === contactId) || null, [clientes, contactId]);
  const servicio = useMemo(() => servicios.find((s) => s.id === serviceId) || null, [servicios, serviceId]);

  /**
   * Lo que falta para poder enviar. Se calcula acá y no al recibir el error del
   * endpoint: el botón dice por qué está apagado.
   */
  const impedimento = useMemo(() => {
    if (!cuenta) return "Elegí por cuál cuenta entró el dinero.";
    if (!(Number(monto) > 0)) return "Indicá el monto recibido.";
    if (modo === "cita") {
      if (!cita) return "Elegí la cita que se cobró.";
      if (cita.impedimento) return `No se puede facturar: ${cita.impedimento}.`;
      return null;
    }
    if (!cliente) return "Elegí el cliente.";
    if (cliente.impedimento) return `${cliente.etiqueta.split(" · ")[0]} está ${cliente.impedimento}: completá su ficha antes de facturar.`;
    if (!servicio) return "Elegí el servicio: de ahí salen el CABYS y el impuesto de la línea.";
    if (servicio.impedimento) return `El servicio ${servicio.impedimento}.`;
    if (descripcion.trim().length < 5) return "Describí qué se cobró: es el detalle que lee el cliente.";
    return null;
  }, [cuenta, monto, modo, cita, cliente, servicio, descripcion]);

  /** Al elegir cita o tipo de cobro, se sugiere el monto en vez de teclearlo. */
  function sugerirMonto(citaElegida, tipoElegido) {
    if (!citaElegida) return;
    const mitad = Math.round(citaElegida.precio / 2);
    if (tipoElegido === "DEPOSIT_50" || tipoElegido === "PENALTY_50") setMonto(String(mitad));
    else if (tipoElegido === "BALANCE_50") setMonto(String(citaElegida.saldo || mitad));
    else setMonto(String(citaElegida.saldo || citaElegida.precio));
  }

  function limpiar() {
    setMonto("");
    setReferencia("");
    setDescripcion("");
    setCitaId("");
    setFechaPago(ahoraParaInput());
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (impedimento || enviando) return;
    setEnviando(true);
    try {
      const cuerpo = {
        monto: Number(monto),
        cuenta,
        referencia: referencia.trim() || undefined,
        // El input entrega hora local; el servidor corre en UTC. Sin convertir,
        // un pago de la tarde se guardaría con otra hora.
        fechaPago: new Date(fechaPago).toISOString(),
        ...(modo === "cita"
          ? { appointmentId: citaId, tipo }
          : { contactId, serviceId, descripcion: descripcion.trim() }),
      };

      const respuesta = await fetch("/api/admin/pagos-manuales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        avisar(datos.message || "No se pudo registrar el pago. Volvé a intentarlo.", "error");
        return;
      }

      const numero = datos.invoiceNumber || "—";
      if (datos.feStatus === "ACCEPTED") {
        avisar(`Factura ${numero} emitida y aceptada por Hacienda. El comprobante va al correo del cliente.`, "success");
      } else if (datos.feStatus === "REJECTED") {
        // El consecutivo ya se consumió: esto no se arregla volviendo a enviar el
        // mismo cobro, se corrige y se reenvía la factura desde facturación.
        avisar(
          `Factura ${numero} emitida, pero Hacienda la RECHAZÓ. No se le envió nada al cliente. ${datos.feErrorMessage || ""}`.trim(),
          "error"
        );
      } else {
        avisar(
          `Factura ${numero} creada. El envío a Hacienda quedó pendiente y se reintenta solo; el comprobante se envía cuando se acepte.`,
          "info"
        );
      }
      limpiar();
      router.refresh();
    } catch {
      avisar("No se pudo contactar al servidor. Volvé a intentarlo.", "error");
    } finally {
      setEnviando(false);
    }
  }

  const campo = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm";
  const etiqueta = "text-sm font-semibold text-slate-700";

  return (
    <form onSubmit={enviar} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap gap-2">
        {[
          { valor: "cita", etiqueta: "Cobro de una cita" },
          { valor: "suelto", etiqueta: "Cobro sin cita" },
        ].map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => setModo(opcion.valor)}
            aria-pressed={modo === opcion.valor}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              modo === opcion.valor
                ? "border-brand-800 bg-brand-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>

      {modo === "cita" ? (
        <div className="space-y-4">
          <label className="block">
            <span className={etiqueta}>Cita cobrada</span>
            <select
              value={citaId}
              onChange={(e) => {
                setCitaId(e.target.value);
                sugerirMonto(citas.find((c) => c.id === e.target.value), tipo);
              }}
              className={campo}
            >
              <option value="">Elegí una cita…</option>
              {citas.map((opcion) => (
                <option key={opcion.id} value={opcion.id} disabled={Boolean(opcion.impedimento)}>
                  {opcion.etiqueta} · {colones(opcion.precio)}
                  {opcion.impedimento ? " — no facturable" : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Solo aparecen las citas de él que están sin pagar o pagadas a medias.
              {citas.length === 0 ? " Ahora mismo no hay ninguna." : ""}
            </span>
          </label>

          {cita ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                Precio de la consulta <b>{colones(cita.precio)}</b> · ya cobrado{" "}
                <b>{colones(cita.pagado)}</b> · saldo <b>{colones(cita.saldo)}</b> · la cita está{" "}
                {ETIQUETA_ESTADO_PAGO[cita.paymentStatus] || cita.paymentStatus}.
              </p>
              {cita.impedimento ? (
                <p className="mt-2 font-semibold text-accent-900">No se puede facturar: {cita.impedimento}.</p>
              ) : null}
            </div>
          ) : null}

          <label className="block sm:max-w-xs">
            <span className={etiqueta}>Tipo de cobro</span>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                sugerirMonto(cita, e.target.value);
              }}
              className={campo}
            >
              {TIPOS_DE_COBRO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className={etiqueta}>Cliente</span>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={campo}>
              <option value="">Elegí un cliente…</option>
              {clientes.map((opcion) => (
                <option key={opcion.id} value={opcion.id} disabled={Boolean(opcion.impedimento)}>
                  {opcion.etiqueta}
                  {opcion.impedimento ? ` — ${opcion.impedimento}` : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              La factura electrónica exige nombre e identificación del receptor: quien no los tenga
              cargados aparece deshabilitado hasta que se completen en su ficha.
            </span>
          </label>

          <label className="block">
            <span className={etiqueta}>Servicio</span>
            <select
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                const elegido = servicios.find((s) => s.id === e.target.value);
                if (elegido?.precio && !monto) setMonto(String(elegido.precio));
              }}
              className={campo}
            >
              <option value="">Elegí un servicio…</option>
              {servicios.map((opcion) => (
                <option key={opcion.id} value={opcion.id} disabled={Boolean(opcion.impedimento)}>
                  {opcion.etiqueta}
                  {opcion.impedimento ? ` — ${opcion.impedimento}` : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              De ahí salen el CABYS y el impuesto de la línea. No se factura un servicio sin ellos.
            </span>
          </label>

          <label className="block">
            <span className={etiqueta}>Qué se cobró</span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Consulta del 28 de setiembre de 2026"
              className={campo}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Es el detalle que el cliente lee en su factura.
            </span>
          </label>

          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Un cobro sin cita <b>no entra en ninguna liquidación</b> ni mueve la escalera de precios:
            queda como ingreso directo de la sociedad. Si hubo consulta agendada, cobrala desde
            «Cobro de una cita».
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={etiqueta}>Monto recibido (IVA incluido)</span>
          <input
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            type="number"
            min="1"
            step="0.01"
            inputMode="decimal"
            className={campo}
          />
          <span className="mt-1 block text-xs text-slate-500">
            El total que entró. El impuesto se desglosa hacia adentro, no se suma.
          </span>
        </label>

        <label className="block">
          <span className={etiqueta}>Cuenta por la que entró</span>
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={campo}>
            {cuentas.map((opcion) => (
              <option key={opcion.codigo} value={opcion.codigo}>{opcion.etiqueta}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            Determina el medio de pago que se declara a Hacienda.
          </span>
        </label>

        <label className="block">
          <span className={etiqueta}>Cuándo se recibió</span>
          <input
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
            type="datetime-local"
            className={campo}
          />
          <span className="mt-1 block text-xs text-slate-500">
            La factura se emite hoy —Hacienda rechaza fechas viejas—; esto es la fecha del pago.
          </span>
        </label>

        <label className="block">
          <span className={etiqueta}>Referencia (opcional)</span>
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            maxLength={120}
            placeholder="Número de comprobante o del movimiento"
            className={campo}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Con esto se concilia después contra el estado de cuenta.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={Boolean(impedimento) || enviando}
          className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {enviando ? "Registrando y facturando…" : "Registrar el pago y facturar"}
        </button>
        <p className="text-sm text-slate-500">{impedimento || "Se emite la factura y se envía a Hacienda al confirmar."}</p>
      </div>
    </form>
  );
}
