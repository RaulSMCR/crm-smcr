"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STORAGE_PREFIX = "smcr-admin-daily-tasks";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function AreaBlock({ area, completed, onToggle, onSetValue }) {
  const doneCount = area.tasks.filter((task) => completed[task.id]).length;
  const progress = area.tasks.length ? Math.round((doneCount / area.tasks.length) * 100) : 0;

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">{area.cadence}</div>
          <h2 className="mt-1 text-lg font-bold text-brand-900">{area.title}</h2>
          <p className="mt-1 text-sm text-neutral-650">{area.description}</p>
        </div>
        <div className="min-w-24 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-center">
          <div className="text-xl font-bold text-brand-900">{progress}%</div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">avance</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {area.tasks.map((task) => {
          if (task.kind === "decision") {
            const value = completed[task.id]; // undefined | "none" | "done"
            return (
              <div key={task.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-3">
                <span className="block text-sm font-semibold text-neutral-900">{task.label}</span>
                <span className="mt-0.5 block text-xs text-neutral-600">{task.detail}</span>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700">
                    <input
                      type="checkbox"
                      checked={value === "none"}
                      onChange={() => onSetValue(task.id, value === "none" ? null : "none")}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-500 focus:ring-neutral-400"
                    />
                    No hay
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700">
                    <input
                      type="checkbox"
                      checked={value === "done"}
                      onChange={() => onSetValue(task.id, value === "done" ? null : "done")}
                      className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Completado
                  </label>
                </div>
              </div>
            );
          }

          return (
            <label
              key={task.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 transition hover:border-brand-300"
            >
              <input
                type="checkbox"
                checked={Boolean(completed[task.id])}
                onChange={() => onToggle(task.id)}
                className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand-700 focus:ring-brand-600"
              />
              <span>
                <span className="block text-sm font-semibold text-neutral-900">{task.label}</span>
                <span className="mt-0.5 block text-xs text-neutral-600">{task.detail}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {area.links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:border-brand-300 hover:text-brand-900"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function DailyAdminTasks({ areas, metrics }) {
  const dateKey = todayKey();
  const storageKey = `${STORAGE_PREFIX}:${dateKey}`;
  const [completed, setCompleted] = useState({});

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setCompleted(JSON.parse(saved));
    } catch {
      setCompleted({});
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(completed));
    } catch {
      // Local persistence is helpful, but not required for the admin workflow.
    }
  }, [completed, storageKey]);

  const totals = useMemo(() => {
    const tasks = areas.flatMap((area) => area.tasks);
    const done = tasks.filter((task) => completed[task.id]).length;
    return { done, total: tasks.length };
  }, [areas, completed]);

  function toggleTask(id) {
    setCompleted((current) => ({ ...current, [id]: !current[id] }));
  }

  // Para tareas de decisión (doble check "No hay" / "Completado", excluyentes).
  function setTaskValue(id, value) {
    setCompleted((current) => {
      const next = { ...current };
      if (!value) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  function resetToday() {
    setCompleted({});
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 shadow-card">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">{metric.label}</div>
            <div className="mt-2 text-2xl font-bold text-brand-900">{metric.value}</div>
            <div className="mt-1 text-xs text-neutral-600">{metric.help}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Inventario diario</div>
            <p className="mt-1 text-sm text-brand-950">
              {totals.done} de {totals.total} tareas completadas hoy.
            </p>
          </div>
          <button
            type="button"
            onClick={resetToday}
            className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-semibold text-brand-900 transition hover:bg-brand-100"
          >
            Reiniciar dia
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {areas.map((area) => (
          <AreaBlock
            key={area.id}
            area={area}
            completed={completed}
            onToggle={toggleTask}
            onSetValue={setTaskValue}
          />
        ))}
      </div>
    </div>
  );
}
