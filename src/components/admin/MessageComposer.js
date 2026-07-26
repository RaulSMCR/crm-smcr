"use client";

import { useState, useTransition } from "react";
import { AUDIENCIAS, AUDIENCIAS_REGISTRADAS } from "@/lib/frases-audiencia";
import { enviarMensaje, previsualizarMensaje } from "@/actions/mensajes-actions";

/**
 * Compositor de comunicados. Solo dos modos de destino en esta versión: todos, o
 * por audiencia. Segmentar por profesional y por servicio viene después.
 *
 * Las 4 audiencias de no registrados no aparecen: por construcción no pueden
 * corresponder a nadie con cuenta, así que ofrecerlas sería ofrecer un envío
 * garantizado a cero personas.
 */
export default function MessageComposer() {
  const [pendiente, iniciar] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [tipo, setTipo] = useState("ALL");
  const [audiencias, setAudiencias] = useState([]);
  const [conPush, setConPush] = useState(true);
  const [alcance, setAlcance] = useState(null);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);

  const registradas = AUDIENCIAS.filter((a) => AUDIENCIAS_REGISTRADAS.includes(a.id));

  function alternarAudiencia(id) {
    setAlcance(null);
    setAudiencias((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function previsualizar() {
    setError(null);
    setExito(null);
    iniciar(async () => {
      const r = await previsualizarMensaje({ tipo, audiencias });
      setAlcance(r);
    });
  }

  function enviar() {
    setError(null);
    setExito(null);
    iniciar(async () => {
      const r = await enviarMensaje({ titulo, cuerpo, tipo, audiencias, conPush });
      if (r?.error) {
        setError(r.error);
        return;
      }
      setExito(
        `Enviado a ${r.destinatarios} ${r.destinatarios === 1 ? "persona" : "personas"}` +
          (conPush ? ` · ${r.pushSent} notificaciones push entregadas` : ""),
      );
      setTitulo("");
      setCuerpo("");
      setAlcance(null);
    });
  }

  const listoParaEnviar =
    titulo.trim().length >= 3 &&
    cuerpo.trim().length >= 3 &&
    (tipo === "ALL" || audiencias.length > 0);

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
      <h2 className="text-lg font-bold text-brand-900">Nuevo comunicado</h2>
      <p className="mt-1 text-sm text-neutral-650">
        Llega al buzón de la persona dentro de la app y, si aceptó notificaciones, también como
        push. No admite respuesta.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Título</span>
          <input
            type="text"
            value={titulo}
            maxLength={160}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Cambio en la agenda de esta semana"
            className="mt-1 w-full rounded-lg border-neutral-300 text-sm"
          />
          <span className="mt-1 block text-[11px] text-neutral-500">{titulo.length}/160</span>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Mensaje</span>
          <textarea
            value={cuerpo}
            rows={5}
            onChange={(e) => setCuerpo(e.target.value)}
            placeholder="Escribí el comunicado…"
            className="mt-1 w-full rounded-lg border-neutral-300 text-sm"
          />
          <span className="mt-1 block text-[11px] text-neutral-500">
            Los primeros 160 caracteres son los que se ven en la notificación push.
          </span>
        </label>

        <fieldset>
          <legend className="text-xs font-semibold text-neutral-700">Destinatarios</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {[
              { id: "ALL", label: "Todos los usuarios activos" },
              { id: "AUDIENCE", label: "Por audiencia" },
            ].map((opcion) => (
              <label
                key={opcion.id}
                className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-800"
              >
                <input
                  type="radio"
                  name="tipo-destino"
                  checked={tipo === opcion.id}
                  onChange={() => {
                    setTipo(opcion.id);
                    setAlcance(null);
                  }}
                  className="h-4 w-4 border-neutral-300 text-brand-700 focus:ring-brand-600"
                />
                {opcion.label}
              </label>
            ))}
          </div>

          {tipo === "AUDIENCE" ? (
            <div className="mt-3 space-y-2">
              {registradas.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
                    audiencias.includes(a.id)
                      ? "border-brand-500 bg-brand-50"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={audiencias.includes(a.id)}
                    onChange={() => alternarAudiencia(a.id)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-700 focus:ring-brand-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">
                      {a.id} · {a.label}
                    </span>
                    <span className="block text-xs text-neutral-600">{a.tono}</span>
                  </span>
                </label>
              ))}
              <p className="text-[11px] text-neutral-500">
                Solo aparecen las 4 audiencias de personas registradas. Las otras 4 del corpus son
                de no registrados y no corresponden a nadie con cuenta.
              </p>
            </div>
          ) : null}
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-800">
          <input
            type="checkbox"
            checked={conPush}
            onChange={() => setConPush((v) => !v)}
            className="h-4 w-4 rounded border-neutral-300 text-brand-700 focus:ring-brand-600"
          />
          Enviar también como notificación push
        </label>

        {alcance ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
            <p className="text-sm font-semibold text-brand-950">
              Alcanza a {alcance.total} {alcance.total === 1 ? "persona" : "personas"} ·{" "}
              {alcance.conPush} con push activo
            </p>
            {alcance.total > 0 ? (
              <p className="mt-1 text-xs text-brand-800">
                {Object.entries(alcance.porAudiencia)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            ) : null}
            {alcance.aviso ? (
              <p className="mt-1 text-xs text-brand-800">{alcance.aviso}</p>
            ) : null}
            {alcance.total > 0 && alcance.conPush === 0 && conPush ? (
              <p className="mt-1 text-xs text-accent-950">
                Nadie tiene push activo todavía: el mensaje llegará solo al buzón.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-accent-500 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-950">
            {error}
          </p>
        ) : null}
        {exito ? (
          <p className="rounded-lg border border-brand-500 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900">
            {exito}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={previsualizar}
            disabled={pendiente}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:border-brand-300 disabled:opacity-50"
          >
            {pendiente ? "Calculando…" : "Ver alcance"}
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={pendiente || !listoParaEnviar}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            Enviar comunicado
          </button>
        </div>
      </div>
    </section>
  );
}
