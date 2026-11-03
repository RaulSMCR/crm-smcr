"use client";

// Lo que se puede hacer con una cita por cobrar desde la app:
//   • Reenviar el enlace de ONVO — cualquier profesional, la misma acción que el
//     botón «Cobrar» del panel (reutiliza el enlace vigente si ya existe).
//   • Registrar un pago recibido por otra vía — solo Raúl (`puedeRegistrarManual`
//     lo decide el servidor, y la ruta lo vuelve a exigir). Emite la factura.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { cobrarCita } from "@/actions/payment-actions";
import { formatMoney } from "@/components/mi/ui";

const BOTON =
  "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

function RegistrarPago({ cita, onClose, onDone }) {
  const { avisar } = useToast();
  const [cuentas, setCuentas] = useState([]);
  const [cuenta, setCuenta] = useState("SINPE_MOVIL");
  const [monto, setMonto] = useState(String(cita.monto));
  const [referencia, setReferencia] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/api/pro/pagos-manuales")
      .then((r) => (r.ok ? r.json() : { cuentas: [] }))
      .then((d) => vivo && setCuentas(d.cuentas || []))
      .catch(() => vivo && setCuentas([]));
    return () => {
      vivo = false;
    };
  }, []);

  async function enviar() {
    setError("");
    setEnviando(true);
    try {
      const respuesta = await fetch("/api/pro/pagos-manuales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: cita.id,
          tipo: cita.tipo,
          monto: Number(monto),
          cuenta,
          referencia: referencia.trim() || null,
        }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setError(datos.message || "No se pudo registrar el pago.");
        return;
      }
      // Tres desenlaces distintos, dichos por separado: la factura puede quedar
      // emitida y Hacienda rechazarla, y eso no es «listo».
      if (datos.feStatus === "REJECTED") {
        avisar(`Pago registrado y factura ${datos.invoiceNumber} emitida, pero Hacienda la rechazó. Revísela en Contabilidad.`, "error");
      } else if (datos.feStatus === "ACCEPTED") {
        avisar(`Pago registrado. Factura ${datos.invoiceNumber} aceptada por Hacienda.`, "success");
      } else {
        avisar(`Pago registrado. Factura ${datos.invoiceNumber} enviada a Hacienda; la respuesta llega en unos minutos.`, "success");
      }
      onDone();
    } catch {
      setError("No se pudo registrar el pago. Revise la conexión y vuelva a intentarlo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">Registrar pago</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-xl leading-none text-neutral-400 hover:text-neutral-600">
            ×
          </button>
        </div>
        <p className="text-sm text-neutral-600">
          {cita.paciente} · {cita.fecha}. Se emite la factura, se envía a Hacienda y el paciente recibe el comprobante.
        </p>

        <label className="block text-sm font-medium text-neutral-800">
          Por dónde entró
          <select
            value={cuenta}
            onChange={(e) => setCuenta(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {(cuentas.length ? cuentas : [{ codigo: "SINPE_MOVIL", etiqueta: "SINPE Móvil" }]).map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-neutral-800">
          Monto recibido (₡)
          <input
            type="number"
            inputMode="decimal"
            min="1"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm font-medium text-neutral-800">
          Referencia (opcional)
          <input
            type="text"
            maxLength={120}
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="N.º de comprobante SINPE"
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-start gap-2 text-sm text-neutral-800">
          <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="mt-0.5" />
          Confirmo que el dinero ya entró a la cuenta de la sociedad.
        </label>

        {error ? <p className="text-sm text-accent-800">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${BOTON} border border-neutral-300 text-neutral-800 hover:bg-neutral-100`}>
            Volver
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={!confirmado || enviando || !(Number(monto) > 0)}
            className={`${BOTON} bg-brand-600 text-white hover:bg-brand-500`}
          >
            {enviando ? "Registrando…" : "Registrar y facturar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{ cita: { id: string, paciente: string, fecha: string, monto: number, tipo: string },
 *           puedeRegistrarManual: boolean }} props
 */
export default function AccionesDeCobro({ cita, puedeRegistrarManual }) {
  const router = useRouter();
  const { avisar } = useToast();
  const [reenviando, setReenviando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  async function reenviar() {
    setReenviando(true);
    try {
      const resultado = await cobrarCita(cita.id);
      if (resultado?.success) {
        avisar(resultado.message || `Enlace de ${formatMoney(cita.monto)} enviado al paciente.`, "success");
        router.refresh();
      } else {
        avisar(resultado?.error || "No se pudo enviar el enlace.", "error");
      }
    } catch (fallo) {
      avisar(String(fallo?.message || "").trim() || "No se pudo enviar el enlace.", "error");
    } finally {
      setReenviando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={reenviar} disabled={reenviando} className={`${BOTON} bg-brand-600 text-white hover:bg-brand-500`}>
        {reenviando ? "Enviando…" : "Reenviar enlace ONVO"}
      </button>
      {puedeRegistrarManual ? (
        <button
          type="button"
          onClick={() => setRegistrando(true)}
          className={`${BOTON} border border-neutral-300 text-neutral-800 hover:bg-neutral-100`}
        >
          Registrar pago
        </button>
      ) : null}
      {registrando ? (
        <RegistrarPago
          cita={cita}
          onClose={() => setRegistrando(false)}
          onDone={() => {
            setRegistrando(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
