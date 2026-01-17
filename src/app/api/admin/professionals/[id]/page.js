"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

function Badge({ ok, text }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
        (ok ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800")
      }
    >
      {text}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[200px_1fr] sm:items-start">
      <div className="text-sm font-medium text-neutral-700">{label}</div>
      <div className="text-sm text-neutral-900 break-words">{children}</div>
    </div>
  );
}

export default function AdminProfessionalDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [prof, setProf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [approving, setApproving] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const res = await fetch(`/api/admin/professionals/${id}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "No se pudo cargar el profesional.");

      setProf(data);
    } catch (e) {
      setErr(e.message);
      setProf(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function approve() {
    if (!confirm("¿Aprobar este profesional?")) return;

    setApproving(true);
    try {
      const res = await fetch(`/api/admin/professionals/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al aprobar.");

      // recargar detalle para ver auditoría
      await load();
      alert("Aprobado ✅");
    } catch (e) {
      alert(e.message);
    } finally {
      setApproving(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-800">Detalle del profesional</h1>

          <Link
            href="/admin/professionals"
            className="text-sm text-brand-700 underline"
          >
            ← Volver a pendientes
          </Link>
        </div>

        <p className="text-sm text-neutral-600">
          Revisá información, links y estado antes de aprobar.
        </p>
      </header>

      {loading && <p>Cargando…</p>}

      {err && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {!loading && prof && (
        <div className="rounded-2xl border bg-white p-6 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">{prof.name}</p>
              <p className="text-sm text-neutral-600">{prof.profession}</p>
              <p className="text-sm">{prof.email}</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge ok={prof.emailVerified} text={prof.emailVerified ? "Email verificado" : "Email NO verificado"} />
              <Badge ok={prof.isApproved} text={prof.isApproved ? "Aprobado" : "Pendiente"} />
            </div>
          </div>

          {prof.avatarUrl ? (
            <div className="flex items-center gap-4">
              <img
                src={prof.avatarUrl}
                alt="Avatar"
                className="h-16 w-16 rounded-full object-cover border"
              />
              <a
                href={prof.avatarUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand-700 underline"
              >
                Ver foto en nueva pestaña
              </a>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">Sin foto.</p>
          )}

          <div className="space-y-3">
            <Row label="Teléfono">{prof.phone || "—"}</Row>
            <Row label="Bio">{prof.bio || "—"}</Row>
            <Row label="Time zone">{prof.timeZone || "—"}</Row>

            <Row label="CV/Resume">
              {prof.resumeUrl ? (
                <a
                  href={prof.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 underline"
                >
                  Abrir CV
                </a>
              ) : (
                "—"
              )}
            </Row>

            <Row label="Video intro">
              {prof.introVideoUrl ? (
                <a
                  href={prof.introVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 underline"
                >
                  Abrir link
                </a>
              ) : (
                "—"
              )}
            </Row>

            <Row label="Calendario">
              {prof.calendarUrl ? (
                <a
                  href={prof.calendarUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 underline"
                >
                  Abrir link
                </a>
              ) : (
                "—"
              )}
            </Row>

            <Row label="Pago base">
              {prof.paymentLinkBase ? (
                <a
                  href={prof.paymentLinkBase}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 underline"
                >
                  Abrir link
                </a>
              ) : (
                "—"
              )}
            </Row>
          </div>

          <hr />

          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-800">Auditoría</p>

            <div className="grid gap-2 text-sm text-neutral-700">
              <div>
                <span className="font-medium">Creado:</span>{" "}
                {new Date(prof.createdAt).toLocaleString()}
              </div>

              <div>
                <span className="font-medium">Última actualización:</span>{" "}
                {new Date(prof.updatedAt).toLocaleString()}
              </div>

              <div>
                <span className="font-medium">Aprobado en:</span>{" "}
                {prof.approvedAt ? new Date(prof.approvedAt).toLocaleString() : "—"}
              </div>

              <div>
                <span className="font-medium">Aprobado por userId:</span>{" "}
                {prof.approvedByUserId ?? "—"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.refresh?.()}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Refrescar
            </button>

            <button
              type="button"
              onClick={approve}
              disabled={approving || prof.isApproved || !prof.emailVerified}
              className="
                rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white
                hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {approving ? "Aprobando…" : prof.isApproved ? "Ya aprobado" : "Aprobar"}
            </button>
          </div>

          {!prof.emailVerified && (
            <p className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2">
              No se puede aprobar hasta que verifique su email.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
