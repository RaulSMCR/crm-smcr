"use client";
// src/components/paciente/InsurancePatientUploader.js
import { useRef, useState, useTransition } from "react";

const fileUrl = (value) => String(value || "").startsWith("/") || String(value || "").startsWith("http")
  ? value
  : `/api/files?path=${encodeURIComponent(value)}`;

export default function InsurancePatientUploader({ blankFormUrl }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  if (done) return null;

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setMessage(null);
    const fd = new FormData();
    fd.append("file", file);

    startTransition(async () => {
      try {
        const res = await fetch("/api/upload/insurance-patient-form", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setMessage({ type: "error", text: json.error || "Error al subir el archivo." });
        } else {
          setMessage({ type: "success", text: "Formulario subido. El profesional ha sido notificado." });
          setDone(true);
        }
      } catch {
        setMessage({ type: "error", text: "Error de red. Inténtelo de nuevo." });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
      <div>
        <p className="text-sm font-bold text-amber-900">Formulario de seguro pendiente</p>
        <p className="text-sm text-amber-800 mt-1">
          Su aseguradora requiere que complete su parte del formulario de reclamo.
          Descárguelo, llene únicamente sus datos como asegurado (nombre, cédula, número de póliza, etc.)
          y súbalo de regreso.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={fileUrl(blankFormUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-800"
        >
          Descargar formulario en blanco
        </a>
      </div>

      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm font-medium text-amber-800">Subir mi parte (PDF):</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="text-sm text-amber-700 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-amber-200"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-amber-900 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-950 disabled:opacity-60"
        >
          {isPending ? "Subiendo..." : "Subir formulario"}
        </button>
      </form>

      {message && (
        <p className={`text-sm font-medium ${message.type === "error" ? "text-red-700" : "text-green-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
