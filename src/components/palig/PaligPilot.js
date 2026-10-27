"use client";

// Piloto PALIG en tres pasos, en el orden en que se usan:
//   1. La plantilla de cada paciente: el formulario que Raúl deja listo una vez.
//   2. Con cada comprobante SINPE: factura (nueva o la ya emitida) y formulario
//      con la fecha del pago.
//   3. El formulario firmado: se firma desde acá (o se sube firmado a mano) y le
//      llega al paciente por correo, con la factura si Hacienda ya la aceptó.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const buttonClass = "rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const money = (n) => `₡${Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
const date = (value) => new Date(value).toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica" });
const PASO = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white";

/**
 * Vista previa de dónde cae la fecha. En una plantilla escaneada, flechas para
 * moverla: cada encuadre es distinto y se ajusta una sola vez por paciente.
 */
function VistaPreviaFecha({ patient }) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const PASO_PT = 3;

  async function mover(dx, dy) {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/palig/templates/${patient.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dx, dy }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "No se pudo mover la fecha.");
      setVersion((v) => v + 1);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const flecha = "h-9 w-9 rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50";
  return <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-sm font-medium text-slate-800">
      Vista previa con una fecha de ejemplo{patient.templateEscaneada ? " (recuadro rojo: solo se ve acá, no en el formulario)" : ""}
    </p>
    {patient.templateEscaneada && <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-slate-600">Si la fecha no cae en «Fecha de servicio (atención)», muévala:</span>
      <div className="grid grid-cols-3 gap-1">
        <span /><button type="button" aria-label="Subir" disabled={busy} onClick={() => mover(0, PASO_PT)} className={flecha}>↑</button><span />
        <button type="button" aria-label="Izquierda" disabled={busy} onClick={() => mover(-PASO_PT, 0)} className={flecha}>←</button>
        <button type="button" aria-label="Bajar" disabled={busy} onClick={() => mover(0, -PASO_PT)} className={flecha}>↓</button>
        <button type="button" aria-label="Derecha" disabled={busy} onClick={() => mover(PASO_PT, 0)} className={flecha}>→</button>
      </div>
      {busy && <span className="text-sm text-slate-500">Guardando…</span>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <iframe
      key={version}
      title="Vista previa del formulario"
      src={`/api/palig/templates/${patient.id}?muestra=1&v=${version}#view=FitH`}
      className="h-[640px] w-full rounded-lg border border-slate-200 bg-white"
    />
  </div>;
}

/**
 * Firmar desde el panel: estampa la firma de Raúl (rota entre sus versiones),
 * se revisa el PDF y recién entonces se envía. Solo para plantillas editables;
 * una escaneada se sigue firmando a mano.
 */
function FirmarEnPanel({ claim, onCambio, onEnviado }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const base = `/api/palig/claims/${claim.id}`;

  async function ejecutar(accion) {
    setBusy(accion); setMessage(null);
    try {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "No se pudo completar la operación.");
      if (accion === "firmar") {
        onCambio(json);
        setMessage({ ok: true, text: `Firmado con la versión ${json.firmaVersion}. Revíselo antes de enviarlo.` });
      } else {
        setMessage(json.emailSent
          ? { ok: true, text: json.facturaAdjunta ? "Enviado al paciente con el formulario firmado y la factura." : "Enviado al paciente. La factura le llega aparte cuando Hacienda la acepte." }
          : { ok: false, text: "Quedó guardado, pero el correo no salió. Vuelva a enviarlo para reintentar." });
        onEnviado?.();
      }
    } catch (error) { setMessage({ ok: false, text: error.message }); }
    finally { setBusy(""); }
  }

  return <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-3">
    <button type="button" disabled={Boolean(busy)} onClick={() => ejecutar("firmar")} className={buttonClass}>
      {busy === "firmar" ? "Firmando…" : claim.firmadoEnPanel ? "Firmar con otra versión" : "Firmar"}
    </button>
    {claim.firmadoEnPanel && <>
      <a href={`${base}?file=firmado`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 underline">Ver formulario firmado</a>
      <button type="button" disabled={Boolean(busy)} onClick={() => ejecutar("enviar")} className={buttonClass}>
        {busy === "enviar" ? "Enviando…" : "Enviar al paciente"}
      </button>
    </>}
    {message && <p role="status" className={`w-full text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</p>}
  </div>;
}

function SubirFirmado({ claimId, onListo }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function subir(e) {
    e.preventDefault();
    const file = input.current?.files?.[0];
    if (!file || busy) return;
    setBusy(true); setMessage(null);
    const fd = new FormData(); fd.set("file", file); fd.set("claimId", claimId);
    try {
      const res = await fetch("/api/upload/insurance-signed-form", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo subir el formulario firmado.");
      setMessage(json.emailSent
        ? { ok: true, text: json.facturaAdjunta ? "Enviado al paciente con el formulario firmado y la factura." : "Enviado al paciente. La factura le llega aparte cuando Hacienda la acepte." }
        : { ok: false, text: "Quedó guardado, pero el correo no salió. Vuelva a subirlo para reintentar." });
      onListo?.();
    } catch (error) { setMessage({ ok: false, text: error.message }); }
    finally { setBusy(false); }
  }

  return <form onSubmit={subir} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
    <span className="text-sm font-medium">Formulario firmado (PDF, JPG o PNG):</span>
    <input ref={input} type="file" required accept="application/pdf,image/jpeg,image/png" className="text-sm" />
    <button type="submit" disabled={busy} className={buttonClass}>{busy ? "Enviando…" : "Subir y enviar al paciente"}</button>
    {message && <p role="status" className={`w-full text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</p>}
  </form>;
}

function Documents({ initial }) {
  const router = useRouter();
  const [claim, setClaim] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const base = `/api/palig/claims/${claim.id}`;
  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(base, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setClaim((c) => ({ ...c, ...json }));
    } catch (error) { setMessage(error.message || "No se pudo actualizar el estado."); }
    finally { setBusy(false); }
  }
  return <article className="space-y-3 rounded-xl border border-slate-200 p-4">
    <p className="font-semibold">{claim.patientName || "Documentos generados"} · {date(claim.date)} · {money(claim.amount)}</p>
    <p className="text-sm text-slate-600">
      Factura {claim.invoiceNumber} · {claim.invoiceReady ? "Aceptada por Hacienda" : claim.feStatus === "REJECTED" ? "Rechazada por Hacienda: requiere revisión administrativa" : "Aceptación fiscal pendiente"}
      {" · "}{claim.emailSent ? "Formulario firmado enviado al paciente" : claim.signed ? "Firmado; el correo no salió" : "Falta el formulario firmado"}
    </p>
    <div className="flex flex-wrap gap-4 text-sm font-medium text-blue-700">
      <a href={`${base}?file=form`} target="_blank" rel="noopener noreferrer" className="underline">Descargar formulario para firmar</a>
      {claim.invoiceReady && <><a href={`${base}?file=invoice`} target="_blank" rel="noopener noreferrer" className="underline">Factura PDF</a><a href={`${base}?file=xml`} className="underline">XML aceptado</a></>}
      <a href={`${base}?file=proof`} target="_blank" rel="noopener noreferrer" className="underline">Comprobante SINPE</a>
      {!claim.invoiceReady && <button type="button" disabled={busy} onClick={refresh} className="underline">{busy ? "Consultando…" : "Actualizar estado"}</button>}
    </div>
    {!claim.emailSent && <FirmarEnPanel claim={claim} onCambio={(json) => setClaim((c) => ({ ...c, ...json }))} onEnviado={() => router.refresh()} />}
    <SubirFirmado claimId={claim.id} onListo={() => router.refresh()} />
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
  </article>;
}

export default function PaligPilot({ sessions, patients, invoices = [], recent, today }) {
  const router = useRouter();
  // Paso 2. El eje es el comprobante: se elige el paciente; la factura puede
  // ser nueva o una ya emitida, y la sesión es opcional.
  const [payerId, setPayerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  // Paso 1.
  const [patientId, setPatientId] = useState("");
  const [templateConfirmed, setTemplateConfirmed] = useState(false);
  const [templateMessage, setTemplateMessage] = useState(null);
  const templateInput = useRef(null);
  const proofInput = useRef(null);

  const payer = patients.find((p) => p.id === payerId);
  const payerSessions = sessions.filter((s) => s.patientId === payerId);
  const payerInvoices = invoices.filter((i) => i.patientId === payerId);
  const factura = payerInvoices.find((i) => i.id === invoiceId);
  const patient = patients.find((p) => p.id === patientId);

  async function generate(e) {
    e.preventDefault();
    if (busy || !proof || !confirmed || !payer?.templateReady) return;
    setBusy(true); setMessage(""); setResult(null);
    const fd = new FormData();
    fd.set("patientId", payerId); fd.set("confirmado", "true"); fd.set("proof", proof);
    if (factura) {
      fd.set("invoiceId", factura.id);
    } else {
      fd.set("monto", amount);
      if (sessionId) fd.set("appointmentId", sessionId);
    }
    try {
      const response = await fetch("/api/palig", { method: "POST", body: fd });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "No se pudo completar la operación.");
      setResult({ ...json, patientName: payer.name });
      setConfirmed(false); setProof(null); setPayerId(""); setInvoiceId(""); setSessionId(""); setAmount("");
      if (proofInput.current) proofInput.current.value = "";
      router.refresh();
    } catch (error) { setMessage(error.message || "Se perdió la conexión. Actualice para comprobar si los documentos ya se generaron."); }
    finally { setBusy(false); }
  }

  async function saveTemplate(e) {
    e.preventDefault();
    const file = templateInput.current?.files?.[0];
    if (busy || !file || !patientId || !templateConfirmed) return;
    setBusy(true); setTemplateMessage(null);
    const fd = new FormData(); fd.set("file", file); fd.set("preparadaPorRaul", "true");
    try {
      const response = await fetch(`/api/palig/templates/${patientId}`, { method: "POST", body: fd });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "No se pudo guardar.");
      setTemplateMessage({ ok: true, text: json.tipo === "escaneada"
        ? "Plantilla escaneada guardada. Revise en la vista previa que la fecha caiga en su recuadro; después registre los pagos en el paso 2."
        : "Plantilla guardada. Ya puede registrar los pagos de este paciente en el paso 2." });
      setTemplateConfirmed(false); templateInput.current.value = ""; router.refresh();
    } catch (error) { setTemplateMessage({ ok: false, text: error.message }); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    {/* ── Paso 1 ─────────────────────────────────────────────────────────── */}
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="flex items-center gap-3 text-xl font-bold"><span className={PASO}>1</span>Plantilla del paciente</h2>
      <p className="text-sm text-slate-600">
        Se hace una vez por paciente. Sirven dos formas: el formulario PALIG editable (bájelo en blanco abajo, viene con
        los datos del perfil) o el papel ya firmado por el paciente, escaneado en PDF. Se guarda tal cual; en el editable
        se completan solos, si los dejó vacíos, su nombre, su colegiado y el teléfono de la empresa. En cada pago el
        sistema solo agrega la fecha de atención.
      </p>
      <form onSubmit={saveTemplate}>
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-medium">Paciente
            <select value={patientId} required onChange={(e) => { setPatientId(e.target.value); setTemplateConfirmed(false); setTemplateMessage(null); if (templateInput.current) templateInput.current.value = ""; }} className={inputClass}>
              <option value="">Seleccione el paciente</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}{p.templateReady ? " · plantilla guardada" : " · sin plantilla"}</option>)}
            </select>
          </label>
          {/* Sin esto la lista vacía parecía un menú roto. */}
          {!patients.length && <p className="text-sm text-slate-600">Todavía no hay pacientes para elegir. Aparecen aquí quienes tienen al menos una cita con Raúl y figuran con seguro PALIG (márquelo en Admin → Seguros o al crear su acuerdo de atención).</p>}
          {patient && <div className="flex flex-wrap gap-4 text-sm text-blue-700">
            <a className="underline" href={`/api/palig/templates/${patient.id}`} target="_blank" rel="noopener noreferrer">Bajar formulario en blanco para armar la plantilla</a>
            {patient.templateReady && <a className="underline" href={`/api/palig/templates/${patient.id}?guardada=1`} target="_blank" rel="noopener noreferrer">Ver la plantilla guardada</a>}
          </div>}
          <label className="block text-sm font-medium">Plantilla completada (PDF editable o escaneado)<input ref={templateInput} type="file" required accept="application/pdf" className={inputClass} /></label>
          <label className="flex items-start gap-2 text-sm"><input className="mt-1" required type="checkbox" checked={templateConfirmed} onChange={(e) => setTemplateConfirmed(e.target.checked)} />Confirmo que Raúl completó y revisó los datos de la plantilla.</label>
          <button type="submit" disabled={busy || !patientId || !templateConfirmed} className={buttonClass}>{patient?.templateReady ? "Reemplazar plantilla" : "Guardar plantilla"}</button>
        </fieldset>
        {templateMessage && <p role="status" className={`mt-3 text-sm ${templateMessage.ok ? "text-green-700" : "text-red-700"}`}>{templateMessage.text}</p>}
      </form>
      {patient?.templateReady && <VistaPreviaFecha key={`${patient.id}-${patient.templateEscaneada}`} patient={patient} />}
    </section>

    {/* ── Paso 2 ─────────────────────────────────────────────────────────── */}
    <form onSubmit={generate} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="flex items-center gap-3 text-xl font-bold"><span className={PASO}>2</span>Comprobante, factura y formulario</h2>
      <p className="text-sm text-slate-600">Profesional: <strong>Raúl Olmedo</strong> · Pago: <strong>SINPE Móvil</strong> · Hoy: <strong>{date(`${today}T12:00:00-06:00`)}</strong></p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-medium">Paciente que pagó
          <select required value={payerId} onChange={(e) => { setPayerId(e.target.value); setInvoiceId(""); setSessionId(""); setAmount(""); setConfirmed(false); }} className={inputClass}>
            <option value="">Seleccione el paciente</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}{p.templateReady ? "" : " · falta plantilla"}</option>)}
          </select>
        </label>
        {payer && !payer.templateReady && <p className="text-sm text-amber-800">Este paciente todavía no tiene plantilla: guárdela primero en el paso 1.</p>}
        {payer && (
          <label className="block text-sm font-medium">Factura
            <select value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); setSessionId(""); setConfirmed(false); }} className={inputClass}>
              <option value="">Emitir una factura nueva con la fecha de hoy</option>
              {payerInvoices.map((i) => <option key={i.id} value={i.id}>Ya emitida: {i.label}</option>)}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              {factura
                ? "No se emite otra factura: se genera solo el formulario, con la fecha de pago de esta factura."
                : "Si el pago ya se facturó (por ejemplo, desde pagos manuales), elíjalo aquí para no facturarlo dos veces."}
            </span>
          </label>
        )}
        {payer && !factura && (
          <>
            <label className="block text-sm font-medium">Sesión que queda pagada (opcional)
              <select value={sessionId} onChange={(e) => { const s = payerSessions.find((item) => item.id === e.target.value); setSessionId(e.target.value); if (s) setAmount(String(s.amount)); }} className={inputClass}>
                <option value="">Ninguna: solo registrar el pago</option>
                {payerSessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <span className="mt-1 block text-xs text-slate-500">La factura y el formulario salen igual con la fecha de hoy. Elegir una sesión solo la marca como pagada en la agenda.</span>
            </label>
            <label className="block text-sm font-medium">Monto recibido, IVA incluido (CRC)
              <input type="number" required min="0.01" max="99999999.99" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </label>
          </>
        )}
        <label className="block text-sm font-medium">Comprobante de pago SINPE Móvil
          <input ref={proofInput} type="file" required accept="application/pdf,image/jpeg,image/png" onChange={(e) => setProof(e.target.files?.[0] || null)} className={inputClass} />
          <span className="mt-1 block text-xs text-slate-500">PDF, JPG o PNG, hasta 4 MB.</span>
        </label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
          {factura
            ? "Confirmo que este comprobante corresponde al pago de la factura elegida."
            : "Confirmo que recibí hoy este monto por SINPE Móvil. La factura y la fecha de atención del formulario quedan con la fecha de hoy."}
        </label>
        <button type="submit" className={buttonClass} disabled={!payer?.templateReady || !proof || !confirmed || busy || (!factura && !(Number(amount) > 0))}>
          {busy ? "Procesando…" : factura ? "Generar el formulario" : "Emitir factura y generar el formulario"}
        </button>
      </fieldset>
      <p className="text-xs text-slate-500">La factura se envía a Hacienda y le llega al paciente por el correo habitual cuando la acepta. El formulario conserva todo lo de la plantilla; el sistema solo completa la fecha de atención.</p>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    </form>
    {result && <div role="status"><Documents initial={result} key={result.id} /></div>}

    {/* ── Paso 3 ─────────────────────────────────────────────────────────── */}
    <section className="space-y-3">
      <h2 className="flex items-center gap-3 text-xl font-bold"><span className={PASO}>3</span>Firmar y enviar</h2>
      <p className="text-sm text-slate-600">Baje el formulario, imprímalo, fírmelo y súbalo escaneado o fotografiado: le llega al paciente por correo, con la factura si Hacienda ya la aceptó.</p>
      {recent.filter((c) => c.id !== result?.id).map((c) => <Documents key={`${c.id}-${c.feStatus}-${c.emailSent}`} initial={c} />)}
      {!recent.length && !result && <p className="text-sm text-slate-500">Todavía no hay documentos del piloto.</p>}
    </section>
  </div>;
}
