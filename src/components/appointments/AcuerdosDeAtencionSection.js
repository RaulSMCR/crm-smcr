"use client";

// Acuerdos de atención en la agenda del profesional: pacientes que se atienden
// con una periodicidad fija y sin fecha de fin. Solo se muestra a quien puede
// manejarlos (ver puedeGestionarAcuerdos).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
  crearAcuerdoAction,
  seriesDeGoogleParaAcuerdosAction,
  terminarAcuerdoAction,
} from "@/actions/acuerdo-de-atencion-actions";
import { DIAS_HACIA_ATRAS_PERMITIDOS, ETIQUETA_PERIODICIDAD, PERIODICIDADES } from "@/lib/acuerdos-de-atencion";
import { formatSelectedLabel, instanteDeHoraCR } from "@/lib/appointment-slots";
import { DEFAULT_TZ } from "@/lib/timezone";

const colones = (valor) =>
  new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(Number(valor || 0));

const diaYHora = (fecha) =>
  new Intl.DateTimeFormat("es-CR", { timeZone: DEFAULT_TZ, weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(fecha));

const fechaCorta = (fecha) =>
  new Intl.DateTimeFormat("es-CR", { timeZone: DEFAULT_TZ, day: "numeric", month: "short", year: "numeric" }).format(new Date(fecha));

const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const etiqueta = "mb-1 block text-sm font-medium text-slate-800";

/** Un instante → día y hora de pared en Costa Rica, como los pide el formulario. */
function fechaYHoraCR(iso) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

function NuevoAcuerdoModal({ patients, services, locations, serie, onClose, onCreado }) {
  const [form, setForm] = useState({
    patientId: serie?.patientId || patients[0]?.id || "",
    serviceId: services[0]?.id || "",
    locationId: locations.length === 1 ? locations[0].id : "",
    fecha: serie ? fechaYHoraCR(serie.proxima).fecha : "",
    hora: serie ? fechaYHoraCR(serie.proxima).hora : "",
    periodicidad: serie?.periodicidad || PERIODICIDADES.WEEKLY,
    precioAcordado: "40000",
    notas: "",
    seguroPalig: false,
    serieGoogleId: serie?.serieId || null,
  });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const cambiar = (clave) => (event) => setForm((s) => ({ ...s, [clave]: event.target.value }));

  const primera = form.fecha && form.hora ? instanteDeHoraCR(form.fecha, form.hora) : null;

  function crear() {
    setError("");
    startTransition(async () => {
      const r = await crearAcuerdoAction(form);
      if (!r?.success) {
        setError(r?.error || "No se pudo crear el acuerdo.");
        return;
      }
      onCreado(r);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Nuevo acuerdo de atención</h2>
          <button onClick={onClose} className="text-xl font-bold leading-none text-slate-400 hover:text-slate-600">×</button>
        </div>

        <p className="text-sm text-slate-600">
          Para pacientes en tratamiento que se atienden con una periodicidad fija. Las sesiones quedan confirmadas, al
          precio acordado, sin adelanto y fuera de la escalera de precios. Se cobran por SINPE Móvil, no por ONVO.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className={etiqueta}>Paciente</span>
            <select value={form.patientId} onChange={cambiar("patientId")} disabled={Boolean(serie)} className={campo}>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.email}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={etiqueta}>Servicio</span>
            <select value={form.serviceId} onChange={cambiar("serviceId")} className={campo}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.title} · {s.durationMin} min</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={etiqueta}>Lugar de atención</span>
            <select value={form.locationId} onChange={cambiar("locationId")} className={campo}>
              {locations.length !== 1 && <option value="">Elegir…</option>}
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={etiqueta}>Periodicidad</span>
            <select value={form.periodicidad} onChange={cambiar("periodicidad")} disabled={Boolean(serie)} className={campo}>
              {Object.values(PERIODICIDADES).map((p) => (
                <option key={p} value={p}>{ETIQUETA_PERIODICIDAD[p]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={etiqueta}>Primera sesión: día</span>
            <input type="date" value={form.fecha} onChange={cambiar("fecha")} disabled={Boolean(serie)} className={campo} />
          </label>
          <label className="block">
            <span className={etiqueta}>Hora (Costa Rica)</span>
            <input type="time" step="600" value={form.hora} onChange={cambiar("hora")} disabled={Boolean(serie)} className={campo} />
          </label>
          <label className="block">
            <span className={etiqueta}>Precio por sesión (₡, IVA incluido)</span>
            <input type="number" min="0" step="500" value={form.precioAcordado} onChange={cambiar("precioAcordado")} className={campo} />
          </label>
          <label className="block">
            <span className={etiqueta}>Notas (opcional)</span>
            <input type="text" value={form.notas} onChange={cambiar("notas")} className={campo} placeholder="Ej.: viene derivado de…" />
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={form.seguroPalig}
            onChange={(e) => setForm((s) => ({ ...s, seguroPalig: e.target.checked }))}
            className="mt-1"
          />
          <span>
            <strong>Paciente con seguro PALIG.</strong> Queda registrado con ese seguro en su perfil, y sus sesiones
            aparecen en el piloto PALIG para generar la factura y el formulario.
          </span>
        </label>

        {primera && (
          <div className="rounded-xl border-l-4 border-blue-600 bg-slate-50 px-4 py-2 text-sm text-slate-800">
            Primera sesión: <strong>{formatSelectedLabel(primera)}</strong> (hora de Costa Rica).{" "}
            {ETIQUETA_PERIODICIDAD[form.periodicidad]}, sin fecha de fin.
            {primera.getTime() <= Date.now() && (
              <> Esa sesión ya ocurrió: queda registrada como <strong>efectuada</strong> y pendiente de cobro.</>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500">
          La primera sesión puede ser una que ya ocurrió, de hasta {DIAS_HACIA_ATRAS_PERMITIDOS} días atrás: las sesiones
          pasadas se registran como efectuadas.
        </p>

        {serie ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Se usa la serie que ya está en su Google Calendar («{serie.titulo || "sin título"}»).{" "}
            <strong>No se envía ninguna invitación nueva</strong>: el paciente sigue con la misma serie y el mismo enlace.
            Paciente, periodicidad y primera sesión salen de esa serie.
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Al crearlo, el paciente recibe <strong>una sola invitación</strong> de Google con el enlace de Meet. Si ya
            tenía una serie anterior en su calendario, use «Buscar series en Google» para adoptarla en vez de crear otra.
          </div>
        )}

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={crear}
            disabled={isPending || !form.patientId || !form.serviceId || !form.locationId || !primera}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Creando…" : "Crear acuerdo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilaAcuerdo({ acuerdo, onTerminado }) {
  const [terminando, setTerminando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [isPending, startTransition] = useTransition();
  const { avisar } = useToast();

  function terminar() {
    startTransition(async () => {
      const r = await terminarAcuerdoAction(acuerdo.id, motivo);
      if (!r?.success) {
        avisar(r?.error || "No se pudo terminar el acuerdo.", "error");
        return;
      }
      avisar(
        `Acuerdo terminado: ${r.canceladas} sesión(es) futura(s) cancelada(s).` +
          (r.googleCortado ? "" : " No se pudo cortar la serie en Google: hágalo a mano."),
        r.googleCortado ? "success" : "info",
      );
      onTerminado();
    });
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-slate-900">{acuerdo.patientName}</p>
          <p className="text-slate-700">
            {ETIQUETA_PERIODICIDAD[acuerdo.periodicidad]}, {diaYHora(acuerdo.inicio)} · {acuerdo.serviceTitle} ·{" "}
            {colones(acuerdo.precioAcordado)}
          </p>
          <p className="text-slate-500">
            Desde el {fechaCorta(acuerdo.inicio)} · {acuerdo.locationName || "Sin lugar"}
            {acuerdo.notas ? ` · ${acuerdo.notas}` : ""}
          </p>
          <p className="text-slate-500">
            {acuerdo.gcalEventId ? "Publicado en Google Calendar" : "Pendiente de publicar en Google (se reintenta cada día)"}
            {acuerdo.meetLink ? (
              <>
                {" · "}
                <a href={acuerdo.meetLink} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
                  Enlace de Meet
                </a>
              </>
            ) : null}
          </p>
        </div>
        {!terminando && (
          <button
            onClick={() => setTerminando(true)}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Terminar acuerdo
          </button>
        )}
      </div>

      {terminando && (
        <div className="mt-3 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
          <p className="text-red-900">
            Se cancelan todas las sesiones futuras y la serie de Google termina hoy. El paciente recibe un solo aviso de Google.
          </p>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={campo}
            placeholder="Motivo (opcional): alta, derivación, pausa del tratamiento…"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setTerminando(false)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800">
              No, volver
            </button>
            <button
              onClick={terminar}
              disabled={isPending}
              className="rounded-xl bg-red-700 px-3 py-1.5 font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {isPending ? "Terminando…" : "Sí, terminar"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function SeriesDeGoogle({ onElegir }) {
  const [series, setSeries] = useState(null);
  const [isPending, startTransition] = useTransition();
  const { avisar } = useToast();

  function buscar() {
    startTransition(async () => {
      const r = await seriesDeGoogleParaAcuerdosAction();
      if (!r?.success) {
        avisar(r?.error || "No se pudo revisar el calendario.", "error");
        return;
      }
      setSeries(r.series);
      if (r.series.length === 0) avisar("No hay series de sus pacientes pendientes de acuerdo.", "info");
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={buscar}
        disabled={isPending}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
      >
        {isPending ? "Revisando Google…" : "Buscar series en Google"}
      </button>
      {series?.length > 0 && (
        <ul className="space-y-2">
          {series.map((s) => (
            <li key={s.serieId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{s.patientName}</p>
                <p className="text-slate-600">
                  {ETIQUETA_PERIODICIDAD[s.periodicidad]}, {diaYHora(s.proxima)} · próxima el {fechaCorta(s.proxima)}
                  {s.titulo ? ` · «${s.titulo}»` : ""}
                </p>
              </div>
              <button
                onClick={() => onElegir(s)}
                className="rounded-xl bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800"
              >
                Crear acuerdo con esta serie
              </button>
            </li>
          ))}
        </ul>
      )}
      {series && (
        <p className="text-xs text-slate-500">
          Crear el acuerdo es opcional y se puede hacer en cualquier momento. Mientras tanto la serie sigue en Google y
          ocupa su agenda igual.
        </p>
      )}
    </div>
  );
}

export default function AcuerdosDeAtencionSection({ acuerdos = [], patients = [], services = [], locations = [] }) {
  const [abierto, setAbierto] = useState(false);
  const [serie, setSerie] = useState(null);
  const router = useRouter();
  const { avisar } = useToast();

  function cerrar() {
    setAbierto(false);
    setSerie(null);
  }

  function alCrear(r) {
    cerrar();
    const partes = [`Acuerdo creado: ${r.creadas} sesión(es) registrada(s).`];
    if (r.omitidas?.length) {
      partes.push(`${r.omitidas.length} se omitieron por chocar con otra cita: revíselas en la agenda.`);
    }
    if (r.serieAdoptada) partes.push("Quedó vinculado a la serie que ya estaba en Google; no se envió invitación nueva.");
    else if (!r.googlePublicado) partes.push("Google no respondió; la serie se publica en la próxima pasada diaria.");
    if (r.seguroMarcado === true) partes.push("El paciente quedó registrado con seguro PALIG.");
    if (r.seguroMarcado === false) partes.push("No se pudo registrar el seguro PALIG: márquelo en Admin → Seguros.");
    const conSalvedad = r.omitidas?.length || (!r.googlePublicado && !r.serieAdoptada) || r.seguroMarcado === false;
    avisar(partes.join(" "), conSalvedad ? "info" : "success");
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Acuerdos de atención</h2>
          <p className="text-sm text-slate-500">
            Pacientes en tratamiento con sesiones fijas e indefinidas. Las citas se generan solas, ocho semanas hacia adelante.
          </p>
        </div>
        <button
          onClick={() => setAbierto(true)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Nuevo acuerdo
        </button>
      </div>

      <SeriesDeGoogle
        onElegir={(s) => {
          setSerie(s);
          setAbierto(true);
        }}
      />

      {acuerdos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No hay acuerdos activos.
        </p>
      ) : (
        <ul className="space-y-3">
          {acuerdos.map((acuerdo) => (
            <FilaAcuerdo key={acuerdo.id} acuerdo={acuerdo} onTerminado={() => router.refresh()} />
          ))}
        </ul>
      )}

      {abierto && (
        <NuevoAcuerdoModal
          patients={patients}
          services={services}
          locations={locations}
          serie={serie}
          onClose={cerrar}
          onCreado={alCrear}
        />
      )}
    </section>
  );
}
