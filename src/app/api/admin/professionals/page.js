"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminProfessionalsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/professionals/pending", {
        method: "GET",
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar los profesionales.");
      }

      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Error inesperado.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id) {
    if (!confirm("¿Aprobar este profesional?")) return;

    setActionId(id);
    try {
      const res = await fetch(`/api/admin/professionals/${id}/approve`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Error al aprobar.");
      }

      // lo sacamos de pendientes en UI
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert(e?.message || "Error inesperado.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <section className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-800">
          Profesionales pendientes
        </h1>
        <p className="text-sm text-neutral-600">
          Revisá perfiles verificados por email antes de aprobarlos.
        </p>
      </header>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={load}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
          disabled={loading}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>

        <span className="text-sm text-neutral-600">
          {loading ? "" : `${items.length} pendiente(s)`}
        </span>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border bg-white p-4 text-sm text-neutral-700">
          No hay profesionales pendientes 🎉
        </div>
      )}

      <ul className="space-y-4">
        {items.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border bg-white p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/professionals/${p.id}`}
                  className="font-semibold text-brand-800 underline"
                >
                  {p.name}
                </Link>

                <span className="text-xs rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5">
                  Pendiente
                </span>
              </div>

              <p className="text-sm text-neutral-600">{p.profession}</p>
              <p className="text-sm">{p.email}</p>

              <div className="flex flex-wrap gap-3 pt-1">
                {p.avatarUrl ? (
                  <a
                    href={p.avatarUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-700 underline"
                  >
                    Ver foto
                  </a>
                ) : (
                  <span className="text-xs text-neutral-500">Sin foto</span>
                )}

                {p.resumeUrl ? (
                  <a
                    href={p.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-700 underline"
                  >
                    Ver CV
                  </a>
                ) : (
                  <span className="text-xs text-neutral-500">Sin CV</span>
                )}

                {p.createdAt ? (
                  <span className="text-xs text-neutral-500">
                    {new Date(p.createdAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href={`/admin/professionals/${p.id}`}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-neutral-50 text-center"
              >
                Ver detalle
              </Link>

              <button
                onClick={() => approve(p.id)}
                disabled={actionId === p.id}
                className="
                  rounded-lg
                  bg-green-600
                  px-4
                  py-2
                  text-sm
                  font-semibold
                  text-white
                  hover:bg-green-700
                  disabled:opacity-60
                  disabled:cursor-not-allowed
                "
              >
                {actionId === p.id ? "Aprobando…" : "Aprobar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
