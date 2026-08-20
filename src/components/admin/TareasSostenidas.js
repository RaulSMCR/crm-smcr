"use client";

// Las cuatro zonas por cadencia, más la racha.
//
// Lo que este componente NO hace, y es deliberado: no muestra ninguna métrica.
// La pantalla de aterrizaje muestra tareas. El único número visible en "Hoy" es
// la racha de días escritos. Un panel que muestra métricas al abrirlo produce
// revisión compulsiva y desplaza a la escritura, que es lo único que mueve el
// proyecto.

import { useState, useTransition } from "react";
import Link from "next/link";
import { marcarTarea, registrarContacto } from "@/actions/tareas-actions";
import { TAREAS, ZONAS } from "@/lib/tareas-sostenidas";

function Racha({ dias }) {
  if (!dias) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        Sin racha todavía. Se empieza escribiendo cualquier cosa hoy.
      </p>
    );
  }
  return (
    <p className="mt-3 text-sm text-slate-700">
      <span className="text-2xl font-bold text-brand-800">{dias}</span>{" "}
      {dias === 1 ? "día seguido escribiendo" : "días seguidos escribiendo"}
    </p>
  );
}

function Tarea({ tarea, registro, onGuardar, guardando }) {
  const [nota, setNota] = useState(registro?.nota || "");
  const hecha = Boolean(registro?.completado);

  return (
    <li className="border-t border-slate-100 py-3 first:border-t-0 first:pt-0">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={hecha}
          disabled={guardando || tarea.automatica || tarea.bloqueada}
          onChange={(e) => onGuardar(tarea, { completado: e.target.checked, nota })}
          className="mt-1 h-4 w-4 shrink-0 accent-brand-700"
        />
        <span className="min-w-0">
          <span className={`font-semibold ${hecha ? "text-slate-500 line-through" : "text-slate-900"}`}>
            {tarea.titulo}
          </span>
          {tarea.minutos ? (
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
              {tarea.minutos} min
            </span>
          ) : null}
          <span className="mt-1 block text-sm leading-relaxed text-slate-600">{tarea.detalle}</span>

          {tarea.bloqueada ? (
            <span className="mt-1 block rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
              {tarea.bloqueada}
            </span>
          ) : null}

          {tarea.enlace ? (
            <a
              href={tarea.enlace.href}
              target={tarea.enlace.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-semibold text-brand-700 underline"
            >
              {tarea.enlace.texto}
            </a>
          ) : null}
        </span>
      </label>

      {tarea.campo && !tarea.bloqueada ? (
        <div className="ml-7 mt-2">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => {
              if ((registro?.nota || "") !== nota) onGuardar(tarea, { completado: hecha, nota });
            }}
            placeholder={tarea.campo.etiqueta}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      ) : null}
    </li>
  );
}

function FormularioContacto({ onListo }) {
  const [destinatario, setDestinatario] = useState("");
  const [canal, setCanal] = useState("email");
  const [pedido, setPedido] = useState("");
  const [estado, setEstado] = useState(null);
  const [pendiente, iniciar] = useTransition();

  function enviar() {
    iniciar(async () => {
      const r = await registrarContacto({ destinatario, canal, pedido });
      if (r?.error) return setEstado(r.error);
      setDestinatario("");
      setPedido("");
      setEstado(null);
      onListo?.();
    });
  }

  return (
    <div className="ml-7 mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <input
          value={destinatario}
          onChange={(e) => setDestinatario(e.target.value)}
          placeholder="A quién contactaste"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="email">Correo</option>
          <option value="instagram">Instagram</option>
          <option value="llamada">Llamada</option>
          <option value="en persona">En persona</option>
        </select>
      </div>
      <input
        value={pedido}
        onChange={(e) => setPedido(e.target.value)}
        placeholder="Qué pediste"
        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={pendiente || !destinatario.trim()}
          className="rounded bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Registrar contacto"}
        </button>
        {estado ? <span className="text-sm text-red-700">{estado}</span> : null}
      </div>
    </div>
  );
}

export default function TareasSostenidas({ registros, racha }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState(null);
  const porClave = Object.fromEntries((registros || []).map((r) => [r.clave, r]));

  function guardar(tarea, { completado, nota }) {
    setError(null);
    iniciar(async () => {
      const r = await marcarTarea({ clave: tarea.clave, cadencia: tarea.cadencia, completado, nota });
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {ZONAS.map((zona) => {
        const tareas = TAREAS.filter((t) => t.cadencia === zona.cadencia);
        return (
          <section key={zona.cadencia} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-bold text-brand-900">{zona.titulo}</h2>
              <p className="text-sm text-slate-500">{zona.bajada}</p>
            </div>

            <ul className="mt-3">
              {tareas.map((t) => (
                <Tarea
                  key={t.clave}
                  tarea={t}
                  registro={porClave[t.clave]}
                  onGuardar={guardar}
                  guardando={pendiente}
                />
              ))}
            </ul>

            {zona.cadencia === "diaria" ? (
              <>
                <FormularioContacto />
                <Racha dias={racha} />
              </>
            ) : null}

            {zona.cadencia === "trimestral" ? (
              <p className="mt-3 text-xs text-slate-500">
                El reporte de cierre del plan SEO/GEO, con lo que quedó abierto y por qué, está en{" "}
                <Link href="/panel/admin/marketing/seo" className="font-semibold text-brand-700 underline">
                  el panel de SEO
                </Link>
                .
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
