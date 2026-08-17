"use client";

// Los procesos de la persona, en su panel.
//
// Lo que NO muestra es tan deliberado como lo que muestra: nunca aparece el tipo
// de cierre ni el texto de la nota. Enterarse por una pantalla de que el propio
// proceso quedó registrado como "baja por abandono" es exactamente la clase de
// cosa que no debería pasarle a nadie. El alta, en cambio, se nombra como el
// logro que es: es de las pocas veces que un sistema puede devolverle a alguien
// una buena noticia sobre sí mismo.
//
// El derecho a pedir el expediente existe y está acá (Ley N.º 8239), pero la
// plataforma no lo tiene: el expediente es de la persona y de su profesional,
// que es su custodio. El botón le hace llegar la solicitud a él.

import { useState, useTransition } from "react";
import { solicitarCopiaExpediente } from "@/actions/caso-actions";

const TONOS = {
  activo: "border-brand-200 bg-brand-50 text-brand-900",
  logro: "border-emerald-200 bg-emerald-50 text-emerald-900",
  neutro: "border-neutral-200 bg-neutral-50 text-neutral-700",
};

function fecha(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Proceso({ proceso }) {
  const [pedido, setPedido] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function pedirCopia() {
    setError("");
    startTransition(async () => {
      const res = await solicitarCopiaExpediente(proceso.id);
      if (res?.error) setError(res.error);
      else setPedido(true);
    });
  }

  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{proceso.profesional}</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Desde el {fecha(proceso.abiertoAt)}
            {proceso.cerradoAt ? ` · cerrado el ${fecha(proceso.cerradoAt)}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            TONOS[proceso.tono] || TONOS.neutro
          }`}
        >
          {proceso.etiqueta}
        </span>
      </div>

      {proceso.tono === "logro" ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Llegaste hasta acá. Si en algún momento querés retomar, tu espacio sigue abierto: no
          empezás de cero.
        </p>
      ) : null}

      <div className="mt-3">
        {pedido ? (
          <p className="text-sm font-medium text-slate-700">
            Le hicimos llegar tu solicitud a tu profesional, que es quien conserva tu expediente.
          </p>
        ) : (
          <button
            type="button"
            onClick={pedirCopia}
            disabled={isPending}
            className="text-sm font-semibold text-brand-700 underline hover:text-brand-900 disabled:opacity-60"
          >
            {isPending ? "Enviando…" : "Pedirle copia de mi expediente"}
          </button>
        )}
        {error ? <p className="mt-1 text-sm text-accent-800">{error}</p> : null}
      </div>
    </li>
  );
}

export default function MisProcesos({ procesos = [] }) {
  if (!procesos.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold text-slate-900">Tus procesos</h2>
      <p className="mt-1 text-sm text-slate-600">
        Cada profesional con el que trabajás lleva un proceso propio. Tu expediente lo conserva
        ese profesional, y tenés derecho a pedirle una copia cuando quieras.
      </p>

      <ul className="mt-4 space-y-3">
        {procesos.map((proceso) => (
          <Proceso key={proceso.id} proceso={proceso} />
        ))}
      </ul>
    </section>
  );
}
