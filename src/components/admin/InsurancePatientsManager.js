"use client";
// src/components/admin/InsurancePatientsManager.js
import { useRef, useState, useTransition } from "react";

export default function InsurancePatientsManager({ patientId, patientName }) {
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
        const res = await fetch("/api/upload/insurance-blank-form", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setMessage({ type: "error", text: json.error || "Error al subir el archivo." });
        } else {
          setMessage({ type: "success", text: "Formulario subido. Se notificó al paciente." });
          if (fileRef.current) fileRef.current.value = "";
        }
      } catch {
        setMessage({ type: "error", text: "Error de red. Inténtelo de nuevo." });
      }
    });
  }

  return (
    <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <span className="text-xs font-medium text-slate-600">Formulario en blanco (PDF):</span>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-slate-200"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
      >
        {isPending ? "Subiendo..." : "Subir formulario"}
      </button>
      {message && (
        <span
          className={`text-xs font-medium ${message.type === "error" ? "text-red-600" : "text-green-600"}`}
        >
          {message.text}
        </span>
      )}
    </form>
  );
}
