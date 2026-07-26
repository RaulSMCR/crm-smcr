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
export default function MessageComposer({ opciones }) {
  const [pendiente, iniciar] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [tipo, setTipo] = useState("ALL");
  const [audiencias, setAudiencias] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [ventana, setVentana] = useState("ANY");
  const [ventanaDias, setVentanaDias] = useState("");
  const [incluirCanceladas, setIncluirCanceladas] = useState(false);
  const [negar, setNegar] = useState(false);
  const [conPush, setConPush] = useState(true);
  const [alcance, setAlcance] = useState(null);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);

  const registradas = AUDIENCIAS.filter((a) => AUDIENCIAS_REGISTRADAS.includes(a.id));

  function invalidar() {
    setAlcance(null);
  }

  function alternarEn(setter) {
    return (id) => {
      invalidar();
      setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };
  }

  const alternarAudiencia = alternarEn(setAudiencias);
  const alternarProfesional = alternarEn(setProfesionales);
  const alternarServicio = alternarEn(setServicios);

  function filtros() {
    return {
      tipo,
      audiencias,
      profesionales,
      servicios,
      ventana,
      ventanaDias,
      incluirCanceladas,
      negar,
    };
  }

  function previsualizar() {
    setError(null);
    setExito(null);
    iniciar(async () => {
      const r = await previsualizarMensaje(filtros());
      setAlcance(r);
    });
  }

  function enviar() {
    setError(null);
    setExito(null);
    iniciar(async () => {
      const r = await enviarMensaje({ ...filtros(), titulo, cuerpo, conPush });
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

  const hayFiltroDeCitas =
    profesionales.length > 0 || servicios.length > 0 || ventana !== "ANY";

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

        <fieldset className="rounded-lg border border-neutral-200 bg-white p-4">
          <legend className="px-1 text-xs font-semibold text-neutral-700">
            Acotar por citas <span className="font-normal text-neutral-500">(opcional)</span>
          </legend>

          <div className="mt-2 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-neutral-700">Profesional</p>
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                {opciones.profesionales.length === 0 ? (
                  <p className="text-xs text-neutral-500">No hay profesionales aprobados.</p>
                ) : (
                  opciones.profesionales.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        checked={profesionales.includes(p.id)}
                        onChange={() => alternarProfesional(p.id)}
                        className="h-4 w-4 rounded border-neutral-300 text-brand-700 focus:ring-brand-600"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">
                        {p.nombre}
                      </span>
                      <span className="shrink-0 text-[10px] text-neutral-500">{p.citas} citas</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-neutral-700">Servicio</p>
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                {opciones.servicios.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={servicios.includes(s.id)}
                      onChange={() => alternarServicio(s.id)}
                      className="h-4 w-4 rounded border-neutral-300 text-brand-700 focus:ring-brand-600"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">
                      {s.nombre}
                    </span>
                    <span className="shrink-0 text-[10px] text-neutral-500">{s.citas} citas</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-700">Ventana</span>
              <select
                value={ventana}
                onChange={(e) => {
                  setVentana(e.target.value);
                  invalidar();
                }}
                className="mt-1 rounded-lg border-neutral-300 text-sm"
              >
                <option value="ANY">Cualquier momento</option>
                <option value="UPCOMING">Con cita futura en pie</option>
                <option value="PAST">Ya se atendieron</option>
              </select>
            </label>

            {ventana === "UPCOMING" ? (
              <label className="block">
                <span className="text-xs font-semibold text-neutral-700">Próximos días</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={ventanaDias}
                  onChange={(e) => {
                    setVentanaDias(e.target.value);
                    invalidar();
                  }}
                  placeholder="sin tope"
                  className="mt-1 w-28 rounded-lg border-neutral-300 text-sm"
                />
              </label>
            ) : null}

            {ventana !== "UPCOMING" ? (
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs font-semibold text-neutral-800">
                <input
                  type="checkbox"
                  checked={incluirCanceladas}
                  onChange={() => {
                    setIncluirCanceladas((v) => !v);
                    invalidar();
                  }}
                  className="h-4 w-4 rounded border-neutral-300 text-brand-700 focus:ring-brand-600"
                />
                Contar también las canceladas
              </label>
            ) : null}
          </div>

          {hayFiltroDeCitas ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-800">
              <input
                type="checkbox"
                checked={negar}
                onChange={() => {
                  setNegar((v) => !v);
                  invalidar();
                }}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-700 focus:ring-brand-600"
              />
              <span>
                Invertir: enviar a quienes <strong>NO</strong> cumplen este filtro
                <span className="mt-0.5 block font-normal text-neutral-600">
                  Para una promoción suele ser lo que se quiere: llegar a quien todavía no agendó
                  ese servicio.
                </span>
              </span>
            </label>
          ) : null}

          {!hayFiltroDeCitas ? (
            <p className="mt-3 text-[11px] text-neutral-500">
              Sin acotar: el comunicado va a todo el conjunto base, hayan agendado o no.
            </p>
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
              Alcanza a {alcance.total} {alcance.total === 1 ? "persona" : "personas"}
              {alcance.base ? ` de ${alcance.base}` : ""} · {alcance.conPush} con push activo
            </p>
            {alcance.descripcion ? (
              <p className="mt-1 text-xs font-semibold text-brand-900">
                Filtro: {alcance.descripcion}
              </p>
            ) : null}
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
