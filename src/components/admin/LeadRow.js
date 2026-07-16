"use client";

import { useState, useTransition } from "react";
import { updateLeadStatus } from "@/actions/lead-actions";

const STATUS_PILL = {
  NEW: "border-amber-200 bg-amber-50 text-amber-800",
  CONTACTED: "border-sky-200 bg-sky-50 text-sky-800",
  CONVERTED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  DISCARDED: "border-neutral-200 bg-neutral-100 text-neutral-500",
};

const STATUS_LABEL = {
  NEW: "Sin atender",
  CONTACTED: "Contactado",
  CONVERTED: "Registrado",
  DISCARDED: "Descartado",
};

const CHANNEL_LABEL = {
  CONTACT_FORM: "Contacto",
  FAQ_FORM: "FAQ",
  WHATSAPP: "WhatsApp",
};

function origin(lead) {
  if (lead.utmSource) {
    const medium = lead.utmMedium ? ` / ${lead.utmMedium}` : "";
    return `${lead.utmSource}${medium}`;
  }
  if (lead.referrer) return `Ref: ${lead.referrer}`;
  return "Directo";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function LeadRow({ lead }) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(lead.adminNote || "");
  const [error, setError] = useState(null);

  function apply(status, withNote) {
    setError(null);
    startTransition(async () => {
      const result = await updateLeadStatus(lead.id, status, withNote ? note : undefined);
      if (result?.error) setError(result.error);
    });
  }

  const phoneDigits = (lead.phone || "").replace(/[^\d]/g, "");
  const mailtoSubject = encodeURIComponent(`Respuesta a tu consulta — Salud Mental Costa Rica`);

  return (
    <>
      <tr className={lead.status === "NEW" ? "bg-amber-50/30" : ""}>
        <td className="py-3 pr-4 align-top">
          <div className="font-semibold text-neutral-900">{lead.name}</div>
          <a href={`mailto:${lead.email}?subject=${mailtoSubject}`} className="text-xs text-brand-700 hover:underline">
            {lead.email}
          </a>
          {lead.phone ? <div className="text-xs text-neutral-500">{lead.phone}</div> : null}
        </td>
        <td className="py-3 pr-4 align-top">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
            {CHANNEL_LABEL[lead.channel] || lead.channel}
          </span>
        </td>
        <td className="max-w-[280px] py-3 pr-4 align-top text-sm text-neutral-700">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-left hover:text-neutral-950">
            <span className={expanded ? "" : "line-clamp-2"}>{lead.message}</span>
            {lead.message.length > 90 ? (
              <span className="ml-1 text-xs font-semibold text-brand-700">{expanded ? "menos" : "más"}</span>
            ) : null}
          </button>
        </td>
        <td className="py-3 pr-4 align-top text-xs text-neutral-600">
          <div>{origin(lead)}</div>
          {lead.utmCampaign ? <div className="text-neutral-400">{lead.utmCampaign}</div> : null}
        </td>
        <td className="py-3 pr-4 align-top text-xs text-neutral-500">{formatDate(lead.createdAt)}</td>
        <td className="py-3 pr-4 align-top">
          <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_PILL[lead.status]}`}>
            {STATUS_LABEL[lead.status]}
          </span>
        </td>
        <td className="py-3 align-top">
          <div className="flex flex-wrap items-center gap-1.5">
            {lead.status !== "CONTACTED" && lead.status !== "CONVERTED" ? (
              <button
                type="button"
                onClick={() => apply("CONTACTED", false)}
                disabled={isPending}
                className="rounded-lg bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
              >
                Marcar contactado
              </button>
            ) : null}
            {lead.status !== "DISCARDED" ? (
              <button
                type="button"
                onClick={() => apply("DISCARDED", false)}
                disabled={isPending}
                className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-60"
              >
                Descartar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => apply("NEW", false)}
                disabled={isPending}
                className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-60"
              >
                Reabrir
              </button>
            )}
            <a
              href={`mailto:${lead.email}?subject=${mailtoSubject}`}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              title="Responder por correo"
            >
              ✉ Correo
            </a>
            {phoneDigits.length >= 8 ? (
              <a
                href={`https://wa.me/${phoneDigits}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                title="Escribir por WhatsApp"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
          {error ? <div className="mt-1 text-xs text-rose-600">{error}</div> : null}
        </td>
      </tr>
      <tr className={lead.status === "NEW" ? "bg-amber-50/30" : ""}>
        <td colSpan={7} className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={'Nota interna. Ej: "Le respondí por correo el 16/7, pide precios de nutrición"'}
              className="min-w-[280px] flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-700"
            />
            <button
              type="button"
              onClick={() => apply(lead.status, true)}
              disabled={isPending || note === (lead.adminNote || "")}
              className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              Guardar nota
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}
