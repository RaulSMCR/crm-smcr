"use client";

// Acuerdos de atención en la agenda del profesional: pacientes que se atienden
// con una periodicidad fija y sin fecha de fin. Solo se muestra a quien puede
// manejarlos (ver puedeGestionarAcuerdos).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { crearAcuerdoAction, terminarAcuerdoAction } from "@/actions/acuerdo-de-atencion-actions";
import { ETIQUETA_PERIODICIDAD, PERIODICIDADES } from "@/lib/acuerdos-de-atencion";
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

function NuevoAcuerdoModal({ patients, services, locations, onClose, onCreado }) {
  const [form, setForm] = useState({
    patientId: patients[0]?.id || "",
    serviceId: services[0]?.id || "",
    locationId: locations.length === 1 ? locations[0].id : "",
    fecha: "",
    hora: "",
    periodicidad: PERIODICIDADES.WEEKLY,
    precioAcordado: "40000",
    notas: "",
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
            <select value={form.patientId} onChange={cambiar("patientId")} className={campo}>
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
            <select value={form.periodicidad} onChange={cambiar("periodicidad")} className={campo}>
              {Object.values(PERIODICIDADES).map((p) => (
                <option key={p} value={p}>{ETIQUETA_PERIODICIDAD[p]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={etiqueta}>Primera sesión: día</span>
            <input type="date" value={form.fecha} onChange={cambiar("fecha")} className={campo} />
          </label>
          <label className="block">
            <span className={etiqueta}>Hora (Costa Rica)</span>
            <input type="time" step="600" value={form.hora} onChange={cambiar("hora")} className={campo} />
          </label>
          <label className="block">
            <span className={etiqueta}>Precio por sesión (₡, IVA incluido)</span>
            <input type="number" min="0" step="500" value={form.precioAcordado} onChange={cambiar("precioAcordado")} className={campo} />
          </label>
          <label className="block">
            <span className={etiqueta}>Notas (opcional)</span>
            <input type="text" value={form.notas} onChange={cambiar("notas")} className={campo} placeholder="Ej.: paciente con seguro PALIG" />
          </label>
        </div>

        {primera && (
          <div className="rounded-xl border-l-4 border-blue-600 bg-slate-50 px-4 py-2 text-sm text-slate-800">
            Primera sesión: <strong>{formatSelectedLabel(primera)}</strong> (hora de Costa Rica).{" "}
            {ETIQUETA_PERIODICIDAD[form.periodicidad]}, sin fecha de fin.
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Al crearlo, el paciente recibe <strong>una sola invitación</strong> de Google con el enlace de Meet. Si ya tenía
          una serie anterior en su calendario, elimínela desde la primera sesión del acuerdo («Este evento y los
          siguientes», sin avisar a los invitados) para que no quede duplicada.
        </div>

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

export default function AcuerdosDeAtencionSection({ acuerdos = [], patients = [], services = [], locations = [] }) {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const { avisar } = useToast();

  function alCrear(r) {
    setAbierto(false);
    const partes = [`Acuerdo creado: ${r.creadas} sesión(es) agendada(s).`];
    if (r.omitidas?.length) {
      partes.push(`${r.omitidas.length} se omitieron por chocar con otra cita: revíselas en la agenda.`);
    }
    if (!r.googlePublicado) partes.push("Google no respondió; la serie se publica en la próxima pasada diaria.");
    avisar(partes.join(" "), r.omitidas?.length || !r.googlePublicado ? "info" : "success");
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
          onClose={() => setAbierto(false)}
          onCreado={alCrear}
        />
      )}
    </section>
  );
}
