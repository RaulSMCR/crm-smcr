"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
  emparejarComoAdmin,
  retirarEmparejamientoComoAdmin,
  sugerenciasDesdeCalendarios,
} from "@/actions/emparejamiento-actions";

const normalizar = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function fecha(iso) {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Costa_Rica",
  });
}

function Emparejar({ paciente, profesionales }) {
  const [professionalId, setProfessionalId] = useState("");
  const [isPending, startTransition] = useTransition();
  const { avisar } = useToast();
  const router = useRouter();

  const yaTiene = new Set(paciente.profesionales.map((p) => p.id));
  const opciones = profesionales.filter((p) => !yaTiene.has(p.id));
  if (opciones.length === 0) return null;

  function emparejar() {
    const pro = profesionales.find((p) => p.id === professionalId)?.name || "el profesional";
    startTransition(async () => {
      const r = await emparejarComoAdmin(paciente.id, professionalId);
      if (!r?.success) {
        avisar(r?.error || "No se pudo emparejar.", "error");
        return;
      }
      avisar(
        r.nuevo ? `${paciente.name} quedó emparejado con ${pro}.` : `${paciente.name} ya estaba con ${pro}.`,
        "success"
      );
      setProfessionalId("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={professionalId}
        onChange={(e) => setProfessionalId(e.target.value)}
        aria-label={`Profesional para ${paciente.name}`}
        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
      >
        <option value="">Sumar profesional…</option>
        {opciones.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={emparejar}
        disabled={!professionalId || isPending}
        className="rounded-xl bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {isPending ? "Guardando…" : "Emparejar"}
      </button>
    </div>
  );
}

function Etiqueta({ paciente, pro }) {
  const [confirmando, setConfirmando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { avisar } = useToast();
  const router = useRouter();

  function retirar() {
    startTransition(async () => {
      const r = await retirarEmparejamientoComoAdmin(paciente.id, pro.id);
      if (!r?.success) {
        avisar(r?.error || "No se pudo retirar el emparejamiento.", "error");
        setConfirmando(false);
        return;
      }
      avisar(`${paciente.name} ya no está emparejado con ${pro.name}.`, "success");
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
      {pro.name}
      {confirmando ? (
        <>
          <span className="font-normal text-slate-600">¿Retirar?</span>
          <button onClick={retirar} disabled={isPending} className="text-red-700 hover:underline disabled:opacity-50">
            {isPending ? "…" : "Sí"}
          </button>
          <button onClick={() => setConfirmando(false)} className="text-slate-600 hover:underline">
            No
          </button>
        </>
      ) : (
        <button
          onClick={() => setConfirmando(true)}
          aria-label={`Retirar a ${pro.name}`}
          title="Retirar emparejamiento"
          className="ml-1 text-slate-400 hover:text-red-700"
        >
          ×
        </button>
      )}
    </span>
  );
}

function Fila({ paciente, profesionales }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-[14rem]">
        <p className="font-semibold text-slate-900">{paciente.name}</p>
        <p className="text-sm text-slate-500">
          {paciente.email}
          {paciente.phone ? ` · ${paciente.phone}` : ""}
        </p>
        <p className="text-xs text-slate-400">Registrado el {fecha(paciente.createdAt)}</p>
        {paciente.profesionales.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {paciente.profesionales.map((p) => (
              <Etiqueta key={p.id} paciente={paciente} pro={p} />
            ))}
          </div>
        )}
      </div>
      <Emparejar paciente={paciente} profesionales={profesionales} />
    </li>
  );
}

function SugerenciasDeGoogle() {
  const [resultado, setResultado] = useState(null);
  const [buscando, startBusqueda] = useTransition();
  const [emparejando, startEmparejar] = useTransition();
  const { avisar } = useToast();
  const router = useRouter();

  function buscar() {
    startBusqueda(async () => {
      const r = await sugerenciasDesdeCalendarios();
      if (!r?.success) {
        avisar(r?.error || "No se pudieron revisar los calendarios.", "error");
        return;
      }
      setResultado(r);
      if (r.sinRespuesta.length) {
        avisar(`Google no respondió para: ${r.sinRespuesta.join(", ")}.`, "info");
      } else if (r.sugerencias.length === 0) {
        avisar("Los calendarios no muestran emparejamientos pendientes.", "success");
      }
    });
  }

  function emparejar(s) {
    startEmparejar(async () => {
      const r = await emparejarComoAdmin(s.patientId, s.professionalId);
      if (!r?.success) {
        avisar(r?.error || "No se pudo emparejar.", "error");
        return;
      }
      avisar(`${s.patientName} quedó emparejado con ${s.professionalName}.`, "success");
      setResultado((prev) => ({
        ...prev,
        sugerencias: prev.sugerencias.filter(
          (x) => !(x.patientId === s.patientId && x.professionalId === s.professionalId)
        ),
      }));
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Desde Google Calendar</h2>
          <p className="text-sm text-slate-600">
            Pacientes registrados que figuran como invitados en el calendario de un profesional y todavía no están
            emparejados con él.
          </p>
        </div>
        <button
          onClick={buscar}
          disabled={buscando}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
        >
          {buscando ? "Revisando…" : "Buscar en los calendarios"}
        </button>
      </div>
      {resultado?.sugerencias?.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {resultado.sugerencias.map((s) => (
            <li key={`${s.patientId}-${s.professionalId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {s.patientName} → {s.professionalName}
                </p>
                <p className="text-sm text-slate-500">
                  {s.email} · {s.resumen}
                </p>
              </div>
              <button
                onClick={() => emparejar(s)}
                disabled={emparejando}
                className="rounded-xl bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                Emparejar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PacientesEmparejamiento({ pacientes = [], profesionales = [] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return pacientes;
    return pacientes.filter((p) => normalizar(`${p.name} ${p.email} ${p.phone}`).includes(q));
  }, [pacientes, busqueda]);

  const sinProfesional = filtrados.filter((p) => p.profesionales.length === 0);
  const conProfesional = filtrados.filter((p) => p.profesionales.length > 0);

  return (
    <div className="space-y-6">
      <SugerenciasDeGoogle />

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, correo o teléfono"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
      />

      <section className="rounded-2xl border border-amber-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Sin profesional ({sinProfesional.length})</h2>
        {sinProfesional.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Todos los pacientes tienen al menos un profesional.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {sinProfesional.map((p) => (
              <Fila key={p.id} paciente={p} profesionales={profesionales} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Con profesional ({conProfesional.length})</h2>
        {conProfesional.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nadie todavía.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {conProfesional.map((p) => (
              <Fila key={p.id} paciente={p} profesionales={profesionales} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
