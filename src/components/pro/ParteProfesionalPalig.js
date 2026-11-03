"use client";

// La parte del profesional en el formulario PALIG de un paciente. Se completa
// una vez; de ahí sale la plantilla, y en cada pago el sistema le pone la fecha
// y la firma del profesional. Sus datos (nombre, especialidad, colegiado,
// teléfono de la empresa) se ponen solos desde el perfil.
//
// Los datos clínicos los escribe el profesional: el sistema no los deduce ni
// los completa. Ver /api/pro/seguros/[patientId].
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { Card } from "@/components/mi/ui";

const CAMPO = "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm";
const ETIQUETA = "block text-sm font-medium text-neutral-800";
const BOTON =
  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

// Cada casilla del formulario es de una sola línea: lo que no entra, no se imprime.
const TEXTOS = [
  ["motivo", "Motivo de la consulta (síntomas)", 90, true],
  ["diagnostico", "Diagnóstico", 90, true],
  ["inicioPrimerosSintomas", "Fecha de los primeros síntomas (dd/mm/aa)", 10, false],
  ["tratamientoPrevio", "Tratamientos previos por esta condición", 110, false],
  ["estudios", "Estudios realizados", 110, false],
  ["tratamiento", "Tratamiento indicado", 110, false],
  ["autorizacion", "N.º de autorización de PALIG (si tiene)", 20, false],
  ["observaciones", "Observaciones", 110, false],
];

const LUGARES = [
  ["consultorio", "Consultorio"],
  ["hogar", "Hogar"],
  ["ambulatorio", "Centro ambulatorio"],
  ["otro", "Otro"],
];

export default function ParteProfesionalPalig({ patientId }) {
  const { avisar } = useToast();
  const [estado, setEstado] = useState(null);
  const [datos, setDatos] = useState({ congenita: "no", lugar: "consultorio" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const base = `/api/pro/seguros/${encodeURIComponent(patientId)}`;

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(base, { cache: "no-store" });
      const respuesta = await r.json();
      if (!r.ok) throw new Error(respuesta.message);
      setEstado(respuesta);
      if (respuesta.parteProfesional) setDatos((d) => ({ ...d, ...respuesta.parteProfesional }));
    } catch (e) {
      setError(e?.message || "No se pudo cargar el formulario.");
    }
  }, [base]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    if (estado.plantillaDeOtro && !window.confirm("Este paciente ya tiene una plantilla armada por otro profesional. ¿Reemplazarla por la suya?")) return;
    setGuardando(true);
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datos }),
      });
      const respuesta = await r.json().catch(() => ({}));
      if (!r.ok) {
        avisar(respuesta.message || "No se pudo guardar.", "error");
        return;
      }
      avisar("Plantilla lista. Revise la vista previa.", "success");
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  if (error) return <Card><p className="text-sm text-accent-800">{error}</p></Card>;
  if (!estado) return <p className="text-sm text-neutral-500">Cargando…</p>;

  const paciente = estado.partePaciente;
  // Una plantilla armada a mano antes de este flujo no tiene la parte del
  // paciente cargada por el sistema: no hay sobre qué volver a armarla.
  const armadaAMano = estado.etapa === "LISTO" && !estado.tipo;

  if (armadaAMano) {
    return (
      <Card>
        <p className="font-semibold text-neutral-900">{estado.nombre}</p>
        <p className="mt-1 text-sm text-neutral-700">
          Su plantilla se armó a mano, antes de este sistema, y sigue funcionando igual. Si hay que cambiarla, pídale al
          paciente que entregue su parte en su cuenta (<strong>Seguro PALIG</strong>); después la completa acá.
        </p>
        <a href={`${base}?pdf=muestra`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-brand-700 underline">
          Vista previa de la plantilla
        </a>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="font-semibold text-neutral-900">{estado.nombre}</p>
        {estado.etapa === "SIN_FORMULARIO" ? (
          <p className="mt-1 text-sm text-neutral-700">
            Todavía no entregó su parte del formulario. Pídale que entre a su cuenta, en <strong>Seguro PALIG</strong>: lo llena
            en línea y firma con el dedo, o sube la foto del papel. Le llega un aviso cuando lo haga.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-neutral-700">
              {estado.tipo === "escaneada" ? "Entregó la foto del formulario en papel." : "Llenó su parte en línea y la firmó."}
              {paciente?.poliza ? ` Póliza ${paciente.poliza}.` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <a href={`${base}?pdf=paciente`} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
                Ver su parte
              </a>
              {estado.etapa === "LISTO" ? (
                <a href={`${base}?pdf=muestra`} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
                  Vista previa de la plantilla
                </a>
              ) : null}
            </div>
          </>
        )}
        {estado.etapa === "LISTO" ? (
          <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
            Plantilla lista. En cada pago se arma el formulario con la fecha del pago y su firma, y usted lo revisa antes de enviarlo.
          </p>
        ) : null}
      </Card>

      {estado.etapa !== "SIN_FORMULARIO" ? (
        <Card>
          <h2 className="mb-1 font-semibold text-neutral-900">Su parte</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Su nombre, especialidad, colegiado y el teléfono de la empresa se ponen solos. Las fechas las pone cada pago.
          </p>
          <div className="space-y-3">
            {TEXTOS.map(([clave, etiqueta, largo, obligatorio]) => (
              <label key={clave} className={ETIQUETA}>
                {etiqueta}
                {obligatorio ? <span className="text-accent-700"> *</span> : null}
                <input
                  value={datos[clave] || ""}
                  maxLength={largo}
                  onChange={(e) => setDatos((d) => ({ ...d, [clave]: e.target.value }))}
                  className={CAMPO}
                />
              </label>
            ))}
            <div className={ETIQUETA}>
              ¿Es una condición congénita?
              <div className="mt-1 flex gap-2">
                {[["no", "No"], ["si", "Sí"]].map(([clave, etiqueta]) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => setDatos((d) => ({ ...d, congenita: clave }))}
                    className={`rounded-xl border px-3 py-1.5 text-sm ${datos.congenita === clave ? "border-brand-600 bg-brand-50 font-semibold" : "border-neutral-300"}`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
            <div className={ETIQUETA}>
              Lugar de atención
              <div className="mt-1 flex flex-wrap gap-2">
                {LUGARES.map(([clave, etiqueta]) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => setDatos((d) => ({ ...d, lugar: clave }))}
                    className={`rounded-xl border px-3 py-1.5 text-sm ${datos.lugar === clave ? "border-brand-600 bg-brand-50 font-semibold" : "border-neutral-300"}`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !datos.motivo?.trim() || !datos.diagnostico?.trim()}
            className={`${BOTON} mt-4 w-full bg-brand-600 text-white hover:bg-brand-500`}
          >
            {guardando ? "Guardando…" : estado.etapa === "LISTO" ? "Guardar cambios" : "Guardar y dejar lista la plantilla"}
          </button>
        </Card>
      ) : null}
    </div>
  );
}
