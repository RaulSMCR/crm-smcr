"use client";

import { useEffect, useState } from "react";

export default function AdminProfessionalsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/professionals/pending");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar los profesionales.");
      }

      setItems(data);
    } catch (e) {
      setError(e.message);
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error al aprobar.");
      }

      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert(e.message);
    } finally {
      setActionId(null);
    }
  }

  return (
    <section className="mx-auto max-w-5xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-brand-800">
          Profesionales pendientes
        </h1>
        <p className="text-sm text-neutral-600">
          Revisá y aprobá perfiles antes de publicarlos.
        </p>
      </header>

      {loading && <p>Cargando…</p>}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-neutral-600">
          No hay profesionales pendientes 🎉
        </p>
      )}

      <ul className="space-y-4">
        {items.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border bg-white p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-neutral-600">{p.profession}</p>
              <p className="text-sm">{p.email}</p>

              {p.avatarUrl && (
                <a
                  href={p.avatarUrl}
                  target="_blank"
                  className="text-xs text-brand-600 underline"
                >
                  Ver foto
                </a>
              )}

              {p.resumeUrl && (
                <a
                  href={p.resumeUrl}
                  target="_blank"
                  className="ml-3 text-xs text-brand-600 underline"
                >
                  Ver CV
                </a>
              )}
            </div>

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
              "
            >
              {actionId === p.id ? "Aprobando…" : "Aprobar"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
