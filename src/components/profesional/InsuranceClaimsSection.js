"use client";
// src/components/profesional/InsuranceClaimsSection.js
import { useRef, useState, useTransition } from "react";

const fileUrl = (value) => String(value || "").startsWith("/") || String(value || "").startsWith("http")
  ? value
  : `/api/files?path=${encodeURIComponent(value)}`;

function TemplateUploader({ patientId, patientName, patientFormUrl, onDone }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setMessage(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("patientId", patientId);

    startTransition(async () => {
      try {
        const res = await fetch("/api/upload/insurance-template", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setMessage({ type: "error", text: json.error || "Error al subir la plantilla." });
        } else {
          setMessage({ type: "success", text: "Plantilla guardada correctamente." });
          onDone?.();
        }
      } catch {
        setMessage({ type: "error", text: "Error de red. Inténtelo de nuevo." });
      }
    });
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-yellow-900">{patientName}</p>
        <p className="text-xs text-yellow-700 mt-0.5">
          El paciente completó su parte. Descargue el formulario, llene las secciones del profesional
          <strong> sin incluir la fecha</strong>, y súbalo como plantilla.
        </p>
      </div>
      <a
        href={fileUrl(patientFormUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex text-xs font-semibold text-yellow-800 underline"
      >
        Descargar formulario del paciente ↗
      </a>
      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="text-xs text-yellow-800 file:mr-2 file:rounded-lg file:border-0 file:bg-yellow-100 file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-yellow-200"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-yellow-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-yellow-800 disabled:opacity-60"
        >
          {isPending ? "Subiendo..." : "Subir plantilla"}
        </button>
      </form>
      {message && (
        <p className={`text-xs font-medium ${message.type === "error" ? "text-red-700" : "text-green-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function SignedFormUploader({ claim, onDone }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  const dateStr = claim.paymentDate
    ? new Date(claim.paymentDate).toLocaleDateString("es-CR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setMessage(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("claimId", claim.id);

    startTransition(async () => {
      try {
        const res = await fetch("/api/upload/insurance-signed-form", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setMessage({ type: "error", text: json.error || "Error al subir la planilla." });
        } else {
          setMessage({ type: "success", text: "Planilla enviada al paciente." });
          onDone?.();
        }
      } catch {
        setMessage({ type: "error", text: "Error de red. Inténtelo de nuevo." });
      }
    });
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-blue-900">{claim.patientName}</p>
          {claim.insuranceName && (
            <p className="text-xs text-blue-700">Seguro: {claim.insuranceName}</p>
          )}
        </div>
        <div className="rounded-lg bg-blue-100 px-3 py-1">
          <p className="text-xs text-blue-600 font-medium">Fecha de pago</p>
          <p className="text-sm font-bold text-blue-900">{dateStr}</p>
        </div>
      </div>
      <p className="text-xs text-blue-700">
        Descargue la plantilla, añada la fecha <strong>{dateStr}</strong>, imprima, selle, firme y suba.
      </p>
      {claim.templateUrl && (
        <a
          href={fileUrl(claim.templateUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs font-semibold text-blue-800 underline"
        >
          Descargar plantilla ↗
        </a>
      )}
      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="text-xs text-blue-800 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-blue-200"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-blue-800 disabled:opacity-60"
        >
          {isPending ? "Subiendo..." : "Subir planilla firmada"}
        </button>
      </form>
      {message && (
        <p className={`text-xs font-medium ${message.type === "error" ? "text-red-700" : "text-green-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

export default function InsuranceClaimsSection({ pendingTemplatePatients, pendingSignedClaims }) {
  const [hiddenTemplates, setHiddenTemplates] = useState(new Set());
  const [hiddenClaims, setHiddenClaims] = useState(new Set());

  const visibleTemplates = (pendingTemplatePatients || []).filter((p) => !hiddenTemplates.has(p.id));
  const visibleClaims = (pendingSignedClaims || []).filter((c) => !hiddenClaims.has(c.id));

  if (visibleTemplates.length === 0 && visibleClaims.length === 0) return null;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold text-slate-900">Seguros médicos</h2>

      {visibleTemplates.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Plantillas pendientes de completar ({visibleTemplates.length})
          </p>
          {visibleTemplates.map((p) => (
            <TemplateUploader
              key={p.id}
              patientId={p.id}
              patientName={p.name}
              patientFormUrl={p.insurancePatientFormUrl}
              onDone={() => setHiddenTemplates((prev) => new Set([...prev, p.id]))}
            />
          ))}
        </div>
      )}

      {visibleClaims.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Planillas de seguro para firmar ({visibleClaims.length})
          </p>
          {visibleClaims.map((c) => (
            <SignedFormUploader
              key={c.id}
              claim={c}
              onDone={() => setHiddenClaims((prev) => new Set([...prev, c.id]))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
