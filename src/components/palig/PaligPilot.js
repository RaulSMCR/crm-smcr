"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm";
const buttonClass = "rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const money = (n) => `₡${Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
const date = (value) => new Date(value).toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica" });

function Documents({ initial }) {
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
      setClaim(json);
    } catch (error) { setMessage(error.message || "No se pudo actualizar el estado."); }
    finally { setBusy(false); }
  }
  return <article className="space-y-3 rounded-xl border border-slate-200 p-4">
    <p className="font-semibold">{claim.patientName || "Documentos generados"} · {date(claim.date)} · {money(claim.amount)}</p>
    <p className="text-sm text-slate-600">Factura {claim.invoiceNumber} · {claim.invoiceReady ? "Aceptada por Hacienda" : claim.feStatus === "REJECTED" ? "Rechazada por Hacienda: requiere revisión administrativa" : "Aceptación fiscal pendiente"}</p>
    <div className="flex flex-wrap gap-4 text-sm font-medium text-blue-700">
      {claim.invoiceReady && <><a href={`${base}?file=invoice`} target="_blank" rel="noopener noreferrer" className="underline">Factura PDF</a><a href={`${base}?file=xml`} className="underline">XML aceptado</a></>}
      <a href={`${base}?file=form`} target="_blank" rel="noopener noreferrer" className="underline">Formulario PALIG para firmar</a>
      <a href={`${base}?file=proof`} target="_blank" rel="noopener noreferrer" className="underline">Comprobante SINPE</a>
      {!claim.invoiceReady && <button type="button" disabled={busy} onClick={refresh} className="underline">{busy ? "Consultando…" : "Actualizar estado"}</button>}
    </div>
    <p className="text-xs text-slate-500">El formulario conserva la información preparada por Raúl. Revíselo y complete las firmas antes de entregarlo.</p>
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
  </article>;
}

export default function PaligPilot({ sessions, patients, recent, today, isAdmin }) {
  const router = useRouter();
  // El eje es el comprobante: se elige el paciente; la sesión es opcional.
  const [payerId, setPayerId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [patientId, setPatientId] = useState("");
  const [templateConfirmed, setTemplateConfirmed] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const templateInput = useRef(null);
  const proofInput = useRef(null);
  const payer = patients.find((p) => p.id === payerId);
  const payerSessions = sessions.filter((s) => s.patientId === payerId);
  const patient = patients.find((p) => p.id === patientId);

  async function generate(e) {
    e.preventDefault();
    if (busy || !proof || !confirmed || !payer?.templateReady) return;
    setBusy(true); setMessage(""); setResult(null);
    const fd = new FormData();
    fd.set("patientId", payerId); fd.set("monto", amount); fd.set("confirmado", "true"); fd.set("proof", proof);
    if (sessionId) fd.set("appointmentId", sessionId);
    try {
      const response = await fetch("/api/palig", { method: "POST", body: fd });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "No se pudo completar la operación.");
      setResult(json); setConfirmed(false); setProof(null); setPayerId(""); setSessionId(""); setAmount("");
      if (proofInput.current) proofInput.current.value = "";
      router.refresh();
    } catch (error) { setMessage(error.message || "Se perdió la conexión. Actualice para comprobar si los documentos ya se generaron."); }
    finally { setBusy(false); }
  }

  async function saveTemplate(e) {
    e.preventDefault();
    const file = templateInput.current?.files?.[0];
    if (busy || !file || !patientId || !templateConfirmed) return;
    setBusy(true); setTemplateMessage("");
    const fd = new FormData(); fd.set("file", file); fd.set("preparadaPorRaul", "true");
    try {
      const response = await fetch(`/api/palig/templates/${patientId}`, { method: "POST", body: fd });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "No se pudo guardar.");
      setTemplateMessage("Plantilla guardada. Puede generar los documentos de la atención.");
      setTemplateConfirmed(false); templateInput.current.value = ""; router.refresh();
    } catch (error) { setTemplateMessage(error.message); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <form onSubmit={generate} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold">Factura y formulario PALIG</h2>
      <p className="text-sm text-slate-600">Profesional: <strong>Raúl Olmedo</strong> · Pago: <strong>SINPE Móvil</strong> · Fecha: <strong>{date(`${today}T12:00:00-06:00`)}</strong></p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-medium">Paciente que pagó
          <select required value={payerId} onChange={(e) => { setPayerId(e.target.value); setSessionId(""); setConfirmed(false); }} className={inputClass}>
            <option value="">Seleccione el paciente</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}{p.templateReady ? "" : " · falta plantilla"}</option>)}
          </select>
        </label>
        {!patients.length && <p className="text-sm text-slate-600">Todavía no hay pacientes para elegir. Aparecen aquí quienes tienen al menos una cita con Raúl y figuran con seguro PALIG (márquelo en Admin → Seguros o al crear su acuerdo de atención).</p>}
        {payer && !payer.templateReady && <p className="text-sm text-amber-800">Primero guarde la plantilla preparada por Raúl en la sección de abajo.</p>}
        {payer && (
          <label className="block text-sm font-medium">Sesión que queda pagada (opcional)
            <select value={sessionId} onChange={(e) => { const s = payerSessions.find((item) => item.id === e.target.value); setSessionId(e.target.value); if (s) setAmount(String(s.amount)); }} className={inputClass}>
              <option value="">Ninguna: solo registrar el pago</option>
              {payerSessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <span className="mt-1 block text-xs text-slate-500">La factura y el formulario salen igual con la fecha de hoy. Elegir una sesión solo la marca como pagada en la agenda.</span>
          </label>
        )}
        <label className="block text-sm font-medium">Monto recibido, IVA incluido (CRC)
          <input type="number" required min="0.01" max="99999999.99" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">Comprobante de pago SINPE Móvil
          <input ref={proofInput} type="file" required accept="application/pdf,image/jpeg,image/png" onChange={(e) => setProof(e.target.files?.[0] || null)} className={inputClass} />
          <span className="mt-1 block text-xs text-slate-500">PDF, JPG o PNG, hasta 4 MB. Compruebe que el monto y la fecha coincidan con el pago.</span>
        </label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />Confirmo que recibí hoy este monto por SINPE Móvil. La factura y la fecha de atención del formulario quedan con la fecha de hoy.</label>
        <button type="submit" className={buttonClass} disabled={!payer?.templateReady || !proof || !confirmed || busy}>{busy ? "Procesando…" : "Subir comprobante y generar ambos documentos"}</button>
      </fieldset>
      <p className="text-xs text-slate-500">La factura se envía a Hacienda y se entrega por el correo habitual cuando es aceptada. El formulario conserva todo lo que Raúl escribió en la plantilla; el sistema solo completa la fecha de atención.</p>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    </form>
    {result && <div role="status"><Documents initial={result} key={result.id} /></div>}

    <details className="rounded-2xl border border-slate-200 bg-white p-6">
      <summary className="cursor-pointer text-lg font-semibold">Preparar o actualizar una plantilla por paciente</summary>
      <p className="mt-3 text-sm text-slate-600">Descargue el PDF editable, complételo con los datos que deben figurar en cada formulario y guárdelo conservando los campos editables (no lo imprima ni lo escanee). Se guarda tal como lo sube; la fecha de atención la completa el sistema con la fecha de cada pago.</p>
      <form onSubmit={saveTemplate} className="mt-4 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-medium">Paciente
            <select value={patientId} required onChange={(e) => { setPatientId(e.target.value); setTemplateConfirmed(false); setTemplateMessage(""); if (templateInput.current) templateInput.current.value = ""; }} className={inputClass}>
              <option value="">Seleccione el paciente</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}{p.templateReady ? " · plantilla guardada" : " · sin plantilla"}</option>)}
            </select>
          </label>
          {/* Sin esto la lista vacía parecía un menú roto. */}
          {!patients.length && <p className="text-sm text-slate-600">Todavía no hay pacientes para elegir. Aparecen aquí quienes tienen al menos una cita con Raúl y, en su perfil, marcaron que tienen seguro e indicaron PALIG (o Pan American Life) como aseguradora.</p>}
          {patient && <div className="flex flex-wrap gap-4 text-sm text-blue-700">
            <a className="underline" href={`/api/palig/templates/${patient.id}`} target="_blank" rel="noopener noreferrer">Descargar formulario con datos del perfil</a>
            {patient.templateReady && <a className="underline" href={patient.templateUrl} target="_blank" rel="noopener noreferrer">Ver plantilla guardada</a>}
          </div>}
          <label className="block text-sm font-medium">Plantilla completada por Raúl<input ref={templateInput} type="file" required accept="application/pdf" className={inputClass} /></label>
          <label className="flex items-start gap-2 text-sm"><input className="mt-1" required type="checkbox" checked={templateConfirmed} onChange={(e) => setTemplateConfirmed(e.target.checked)} />Confirmo que Raúl completó y revisó los datos de la plantilla.</label>
          <button type="submit" disabled={busy || !patientId || !templateConfirmed} className={buttonClass}>Guardar plantilla</button>
        </fieldset>
        {templateMessage && <p role="status" className="text-sm">{templateMessage}</p>}
      </form>
    </details>

    <section className="space-y-3"><h2 className="text-xl font-bold">Documentos recientes</h2>
      <p className="text-sm text-slate-600">Puede volver a descargarlos sin generar otra factura. {isAdmin ? "Raúl completa la firma desde su sección de seguros." : "Para subir el formulario firmado, vaya a Seguros médicos dentro de Citas."}</p>
      {recent.filter((c) => c.id !== result?.id).map((c) => <Documents key={`${c.id}-${c.feStatus}`} initial={c} />)}
      {!recent.length && !result && <p className="text-sm text-slate-500">Todavía no hay documentos del piloto.</p>}
    </section>
  </div>;
}
