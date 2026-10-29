"use client";

// App de cobros PALIG en el celular. Con cada comprobante SINPE:
//   1. Se elige el paciente (o lo sugiere el nombre que trae el comprobante).
//   2. Se elige la captura, o llega desde «Compartir» de WhatsApp o del banco.
//   3. El OCR lee monto, fecha y referencia; se revisan y se confirma.
//   4. El mismo endpoint del piloto emite la factura y llena el formulario.
//
// El OCR corre en el navegador (tesseract.js desde el CDN, versión fijada y con
// integridad): la imagen no sale del celular hasta que se envía al CRM. Lo que
// lee es una ayuda; lo que vale es lo que queda en los campos al confirmar.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { leerComprobanteSinpe, sugerirPaciente } from "@/lib/comprobante-sinpe";
import { Documents } from "@/components/palig/PaligPilot";

const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
const TESSERACT_SRI = "sha384-2BQ3U3OdKOb0Uczxqr41I9UvZkzr4V9Hv8uSzMMZAlmhsFClvdZX5wi5fDCzG+tM";
// El servidor acepta hasta 4 MB; se deja margen para el resto del formulario.
const LIMITE = 3.5 * 1024 * 1024;

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900";
const buttonClass = "w-full rounded-xl bg-[#2B7073] px-4 py-3 text-base font-semibold text-white disabled:opacity-50";
const fechaLarga = (ymd) => new Date(`${ymd}T12:00:00-06:00`).toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica", weekday: "long", day: "numeric", month: "long" });

let tesseract = null;
function cargarTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  tesseract ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TESSERACT_URL;
    s.integrity = TESSERACT_SRI;
    s.crossOrigin = "anonymous";
    s.async = true;
    s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error("OCR_NO_DISPONIBLE")));
    s.onerror = () => { tesseract = null; reject(new Error("OCR_NO_DISPONIBLE")); };
    document.head.appendChild(s);
  });
  return tesseract;
}

/**
 * El servidor acepta PDF, JPG o PNG de hasta 4 MB. WhatsApp a veces entrega
 * WEBP y una captura de pantalla puede pasar el límite: en esos casos la imagen
 * se vuelve a dibujar como JPG, sin cambiar lo que se lee.
 */
async function prepararArchivo(file) {
  if (file.type === "application/pdf") {
    if (file.size > LIMITE) throw new Error("El PDF pesa más de 3,5 MB. Mande una captura de pantalla.");
    return file;
  }
  if (["image/jpeg", "image/png"].includes(file.type) && file.size <= LIMITE) return file;
  if (!file.type.startsWith("image/")) throw new Error("El comprobante debe ser una imagen o un PDF.");
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob || blob.size > LIMITE) throw new Error("No se pudo achicar la imagen. Mande una captura de pantalla.");
  return new File([blob], "comprobante.jpg", { type: "image/jpeg" });
}

export default function CobroMovil({ patients, pendientes = [], today }) {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState("");
  const [leyendo, setLeyendo] = useState("");
  const [monto, setMonto] = useState("");
  const [referencia, setReferencia] = useState("");
  const [fechaLeida, setFechaLeida] = useState(null);
  const [montoAlternativo, setMontoAlternativo] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [confirmado, setConfirmado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const input = useRef(null);

  // Libera la vista previa anterior al cambiar de imagen.
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);

  async function procesar(original) {
    setError(""); setAviso(null); setResult(null); setConfirmado(false);
    setMonto(""); setReferencia(""); setFechaLeida(null); setMontoAlternativo(null);
    let file;
    try { file = await prepararArchivo(original); } catch (e) { setError(e.message); return; }
    setArchivo(file);
    setVista(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
    if (!file.type.startsWith("image/")) {
      setAviso({ ok: false, text: "Es un PDF: complete el monto a mano." });
      return;
    }
    setLeyendo("Leyendo el comprobante…");
    try {
      const Tesseract = await cargarTesseract();
      const worker = await Tesseract.createWorker("spa");
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const leido = leerComprobanteSinpe(data.text);
      if (leido.monto) setMonto(String(leido.monto));
      if (leido.referencia) setReferencia(leido.referencia);
      setFechaLeida(leido.fecha);
      setMontoAlternativo(leido.montoAlternativo);
      setPatientId((actual) => actual || sugerirPaciente(data.text, patients) || "");
      setAviso(leido.monto
        ? { ok: true, text: "Datos leídos del comprobante. Revíselos antes de confirmar." }
        : { ok: false, text: "No se pudo leer el monto: escríbalo mirando el comprobante." });
    } catch {
      setAviso({ ok: false, text: "No se pudo leer el comprobante. Complete el monto a mano." });
    } finally { setLeyendo(""); }
  }

  // Service worker (recibe lo compartido) y, si se abrió desde «Compartir»,
  // el comprobante que dejó guardado.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/cobro-sw.js", { scope: "/panel/palig/cobro" }).catch(() => {});
    }
    const estado = new URLSearchParams(window.location.search).get("compartido");
    if (!estado) return;
    window.history.replaceState(null, "", "/panel/palig/cobro");
    if (estado !== "1") {
      setError("No llegó la imagen compartida. Vuelva a compartirla o elíjala desde la galería.");
      return;
    }
    (async () => {
      try {
        const cache = await caches.open("cobro-compartido");
        const res = await cache.match("/panel/palig/cobro/compartido");
        await cache.delete("/panel/palig/cobro/compartido");
        if (!res) throw new Error();
        const blob = await res.blob();
        const nombre = decodeURIComponent(res.headers.get("X-Nombre") || "comprobante");
        await procesar(new File([blob], nombre, { type: blob.type }));
      } catch {
        setError("No llegó la imagen compartida. Vuelva a compartirla o elíjala desde la galería.");
      }
    })();
    // Una sola vez al abrir: procesar solo usa setters y las props del servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reiniciar() {
    setPatientId(""); setArchivo(null); setVista(""); setMonto(""); setReferencia("");
    setFechaLeida(null); setMontoAlternativo(null); setAviso(null); setConfirmado(false); setError(""); setResult(null);
    if (input.current) input.current.value = "";
    // Si el trámite recién emitido no se envió, aparece en «Firmar y enviar».
    router.refresh();
  }

  async function emitir(e) {
    e.preventDefault();
    if (busy || !patientId || !patients.find((p) => p.id === patientId)?.templateReady || !archivo || !confirmado || !(Number(monto) > 0)) return;
    setBusy(true); setError("");
    const fd = new FormData();
    fd.set("patientId", patientId); fd.set("monto", monto); fd.set("confirmado", "true");
    fd.set("proof", archivo);
    if (referencia.trim()) fd.set("referencia", referencia.trim());
    try {
      const res = await fetch("/api/palig", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "No se pudo completar la operación.");
      setResult({ ...json, patientName: patients.find((p) => p.id === patientId)?.name });
    } catch (err) {
      setError(err.message || "Se perdió la conexión. Revise en el piloto si la factura ya se emitió antes de reintentar.");
    } finally { setBusy(false); }
  }

  const otroDia = fechaLeida && fechaLeida !== today;
  const paciente = patients.find((p) => p.id === patientId);
  const sinPlantilla = paciente && !paciente.templateReady;
  const listaPendientes = pendientes.filter((c) => c.id !== result?.id);
  const pendienteDelPaciente = paciente && listaPendientes.some((c) => c.patientId === paciente.id);

  return <main className="mx-auto min-h-screen max-w-md space-y-5 bg-[#F6EFDF] px-4 pb-10 pt-6">
    <header>
      <h1 className="text-2xl font-bold text-[#1E4F52]">Cobros PALIG</h1>
      <p className="text-sm capitalize text-slate-600">{fechaLarga(today)} · SINPE Móvil · Raúl Olmedo</p>
    </header>

    {result ? <section className="space-y-4">
      <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">
        Factura {result.invoiceNumber} emitida y formulario generado. Fírmelo y envíelo desde acá.
      </p>
      <div className="rounded-2xl bg-white"><Documents initial={result} key={result.id} /></div>
      <button type="button" onClick={reiniciar} className={buttonClass}>Registrar otro pago</button>
    </section> : <form onSubmit={emitir} className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
      <fieldset disabled={busy} className="space-y-5">
        <label className="block text-sm font-medium text-slate-800">Paciente
          <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputClass}>
            <option value="">Seleccione el paciente</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}{p.templateReady ? "" : " · falta plantilla"}</option>)}
          </select>
        </label>
        {!patients.length && <p className="text-sm text-amber-800">Ningún paciente de Raúl figura con PALIG. Márquelo en Admin → Seguros.</p>}
        {pendienteDelPaciente && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {paciente.name} tiene un formulario sin enviar en «Firmar y enviar», más abajo. Si es este mismo pago, termínelo ahí en vez de registrarlo otra vez.
        </p>}
        {sinPlantilla && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {paciente.name} todavía no tiene la plantilla PALIG guardada. Guárdela una vez en el <Link href="/panel/palig" className="underline">piloto completo</Link> (paso 1) y después registre el pago acá.
        </p>}

        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-800">Comprobante SINPE</span>
          <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#8FBDBB] bg-[#FBF8F1] px-4 py-5 text-base font-semibold text-[#2B7073]">
            {archivo ? "Cambiar comprobante" : "Elegir captura o PDF"}
            <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) procesar(f); }} />
          </label>
          {/* Vista previa de un blob local: next/image no tiene nada que optimizar. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {vista && <img src={vista} alt="Comprobante elegido" className="max-h-64 w-full rounded-xl border border-slate-200 object-contain" />}
          {archivo && !vista && <p className="text-sm text-slate-600">PDF elegido: {archivo.name}</p>}
          {leyendo && <p role="status" className="text-sm text-slate-600">{leyendo}</p>}
          {aviso && <p role="status" className={`text-sm ${aviso.ok ? "text-green-700" : "text-amber-800"}`}>{aviso.text}</p>}
        </div>

        <label className="block text-sm font-medium text-slate-800">Monto recibido, IVA incluido (₡)
          <input required inputMode="decimal" type="number" min="0.01" max="99999999.99" step="0.01"
            value={monto} onChange={(e) => { setMonto(e.target.value); setMontoAlternativo(null); }} className={inputClass} />
        </label>
        {montoAlternativo && <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p>El símbolo ₡ a veces se lee como un 2. Se tomó ₡{Number(monto).toLocaleString("es-CR")}; si el comprobante dice ₡{montoAlternativo.toLocaleString("es-CR")}, cámbielo.</p>
          <button type="button" onClick={() => { setMonto(String(montoAlternativo)); setMontoAlternativo(null); }}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">Usar ₡{montoAlternativo.toLocaleString("es-CR")}</button>
        </div>}
        <label className="block text-sm font-medium text-slate-800">Referencia del comprobante (opcional)
          <input type="text" inputMode="numeric" maxLength={40} value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs text-slate-500">Queda anotada en la factura.</span>
        </label>
        {otroDia && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          El comprobante dice {fechaLeida.split("-").reverse().join("/")}. La factura y la fecha de atención del formulario salen igual con la fecha de hoy.
        </p>}

        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input type="checkbox" required checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="mt-0.5 h-5 w-5" />
          Confirmo que recibí hoy este monto por SINPE Móvil. La factura y el formulario quedan con la fecha de hoy.
        </label>
        <button type="submit" className={buttonClass}
          disabled={busy || Boolean(leyendo) || !patientId || sinPlantilla || !archivo || !confirmado || !(Number(monto) > 0)}>
          {busy ? "Emitiendo…" : "Emitir factura y formulario"}
        </button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>}

    {listaPendientes.length > 0 && <section className="space-y-3">
      <h2 className="text-lg font-bold text-[#1E4F52]">Firmar y enviar</h2>
      <p className="text-sm text-slate-600">Formularios que todavía no le llegaron al paciente.</p>
      {listaPendientes.map((c) => <div key={`${c.id}-${c.feStatus}-${c.firmaVersion}`} className="rounded-2xl bg-white"><Documents initial={c} /></div>)}
    </section>}

    <p className="text-center text-xs text-slate-500">
      Plantillas y documentos anteriores: <Link href="/panel/palig" className="underline">piloto completo</Link>
    </p>
  </main>;
}
