"use client";

// Lista de pacientes con la agenda en pausa.
//
// El orden de la tarjeta sigue el orden real del trabajo: primero escribirle,
// después restituir. Restituir sin haber contactado deja al paciente creyendo
// que puede agendar sin saber que hay un cargo pendiente, así que el botón de
// restituir es el secundario, no el principal.

import { useState, useTransition } from "react";
import {
  registrarContactoManual,
  restituirAgendaDePaciente,
} from "@/actions/scheduling-block-actions";
import Toast from "@/components/ui/Toast";
import {
  DIAS_ALERTA_SIN_CONTACTO,
  ETIQUETAS_CANAL,
  ETIQUETAS_RESULTADO,
} from "@/lib/reenganche-policy";

// El orden no es alfabético: es el orden real en que se contacta a alguien que
// faltó.
const CANALES_MANUALES = ["WHATSAPP", "LLAMADA", "EMAIL", "PRESENCIAL"];

function formatFecha(valor) {
  if (!valor) return null;
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor));
}

// Registro de un contacto hecho a mano. Va dentro de la tarjeta de cada
// paciente porque el momento de anotarlo es justo después de escribirle, no en
// otra pantalla a la que nadie vuelve.
function RegistrarContacto({ paciente, onHecho, onError }) {
  const [abierto, setAbierto] = useState(false);
  const [canal, setCanal] = useState("WHATSAPP");
  const [resultado, setResultado] = useState("SIN_RESPUESTA");
  const [nota, setNota] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm font-semibold text-brand-700 underline hover:text-brand-900"
      >
        Anotar un contacto
      </button>
    );
  }

  function guardar() {
    startTransition(async () => {
      const res = await registrarContactoManual({
        patientId: paciente.id,
        canal,
        resultado,
        nota,
      });
      if (res?.error) onError(res.error);
      else {
        setAbierto(false);
        setNota("");
        onHecho(paciente);
      }
    });
  }

  const campo = "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900";

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap gap-2">
        <select value={canal} onChange={(e) => setCanal(e.target.value)} className={campo}>
          {CANALES_MANUALES.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETAS_CANAL[valor]}
            </option>
          ))}
        </select>

        <select value={resultado} onChange={(e) => setResultado(e.target.value)} className={campo}>
          {Object.entries(ETIQUETAS_RESULTADO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>

      <input
        type="text"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota (opcional)"
        className={`${campo} mt-2 w-full`}
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={isPending}
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {isPending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function PausedSchedulesPanel({ pacientes = [] }) {
  const [toast, setToast] = useState(null);
  const [restituidos, setRestituidos] = useState([]);
  const [isPending, startTransition] = useTransition();

  const pendientes = pacientes.filter((p) => !restituidos.includes(p.id));

  function restituir(paciente) {
    startTransition(async () => {
      const res = await restituirAgendaDePaciente(paciente.id);
      if (res?.error) {
        setToast({ message: res.error, type: "error" });
        return;
      }
      setRestituidos((prev) => [...prev, paciente.id]);
      setToast({ message: `${paciente.name} ya puede agendar.`, type: "success" });
    });
  }

  if (pendientes.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-medium text-slate-700">No hay agendas en pausa.</p>
        <p className="mt-1 text-sm text-slate-500">
          Acá aparecen los pacientes que hay que contactar antes de que puedan volver a agendar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {pendientes.map((p) => (
          <div key={p.id} className="rounded-2xl border border-amber-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {p.phone || "sin teléfono"} · {p.email}
                </p>
                <p className="mt-2 inline-block rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                  {p.motivo}
                </p>
              </div>

              <dl className="text-right text-sm text-slate-600">
                {p.profesional && (
                  <div>
                    <dt className="sr-only">Profesional</dt>
                    <dd className="font-medium text-slate-800">{p.profesional}</dd>
                  </div>
                )}
                {p.ultimaCita && (
                  <div className="mt-1">
                    <dt className="sr-only">Última cita</dt>
                    <dd>{formatFecha(p.ultimaCita)}</dd>
                  </div>
                )}
                <div className="mt-1 text-xs text-slate-500">
                  En pausa desde {formatFecha(p.bloqueadoDesde)}
                  {p.diasEnPausa > 0 ? ` (${p.diasEnPausa} d)` : ""}
                </div>
                {p.acuerdoPendiente ? (
                  <div className="mt-1 text-xs font-medium text-brand-700">
                    Le falta repasar el acuerdo
                  </div>
                ) : null}
              </dl>
            </div>

            {/* Lo primero que hay que saber al abrir esta lista es si alguien ya
                habló con esta persona. Va antes que los botones. */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {p.contactos?.length ? (
                <>
                  <p
                    className={`text-xs font-semibold ${
                      p.diasSinContacto >= DIAS_ALERTA_SIN_CONTACTO
                        ? "text-accent-800"
                        : "text-slate-600"
                    }`}
                  >
                    {p.diasSinContacto === 0
                      ? "Contactado hoy"
                      : `Sin contactar hace ${p.diasSinContacto} día${p.diasSinContacto === 1 ? "" : "s"}`}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {p.contactos.map((c) => (
                      <li key={c.id}>
                        {formatFecha(c.createdAt)} · {ETIQUETAS_CANAL[c.canal] || c.canal}
                        {c.automatico ? " (automático)" : ""}
                        {c.resultado ? ` · ${ETIQUETAS_RESULTADO[c.resultado] || c.resultado}` : ""}
                        {c.nota ? ` — ${c.nota}` : ""}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs font-semibold text-accent-800">
                  Nadie lo ha contactado todavía.
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {p.whatsapp ? (
                <a
                  href={p.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Escribirle por WhatsApp
                </a>
              ) : (
                <span className="text-sm text-slate-500">
                  Sin teléfono registrado: contactar por correo.
                </span>
              )}

              <button
                type="button"
                onClick={() => restituir(p)}
                disabled={isPending}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {isPending ? "Restituyendo..." : "Restituir el acceso"}
              </button>

              <RegistrarContacto
                paciente={p}
                onHecho={(paciente) =>
                  setToast({ message: `Contacto anotado para ${paciente.name}.`, type: "success" })
                }
                onError={(mensaje) => setToast({ message: mensaje, type: "error" })}
              />
            </div>
          </div>
        ))}
      </div>

      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />
    </>
  );
}
