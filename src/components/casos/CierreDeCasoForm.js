"use client";

// Propuesta de cierre de un caso.
//
// Los campos no son un formulario administrativo: son las preguntas que dentro
// de cinco años va a hacerle al expediente quien lo abra —que puede ser otro
// profesional, la propia persona, o un juzgado—. Por eso los mínimos de
// longitud, y por eso el aviso de que la nota no se edita después.
//
// La baja por abandono es el único cierre que exige algo previo: que conste al
// menos un intento de contacto. La diferencia entre constatar un abandono y
// fabricarlo por omisión es exactamente ese registro.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proponerCierre } from "@/actions/caso-actions";
import { TIPOS_CIERRE } from "@/lib/casos-policy";

const CAMPOS = [
  {
    clave: "evolucion",
    etiqueta: "Cómo evolucionó el proceso",
    ayuda: "Motivo de consulta inicial, abordaje e hitos del recorrido.",
  },
  {
    clave: "estadoActual",
    etiqueta: "Estado al momento del cierre",
    ayuda: "Cómo llega la persona a este punto.",
  },
  {
    clave: "recomendaciones",
    etiqueta: "Recomendaciones y plan",
    ayuda: "Qué le queda por delante y bajo qué condiciones convendría retomar.",
  },
];

export default function CierreDeCasoForm({ casoId, contactosDeReenganche }) {
  const router = useRouter();
  const [tipoCierre, setTipoCierre] = useState("");
  const [valores, setValores] = useState({
    evolucion: "",
    estadoActual: "",
    recomendaciones: "",
    referencia: "",
  });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const tipo = useMemo(() => TIPOS_CIERRE[tipoCierre] || null, [tipoCierre]);
  const faltanContactos = Boolean(tipo?.requiereContactos) && contactosDeReenganche < 1;

  function cambiar(clave, valor) {
    setValores((prev) => ({ ...prev, [clave]: valor }));
  }

  function enviar(e) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await proponerCierre(casoId, { tipoCierre, ...valores });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const campoClase =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-400";

  return (
    <form onSubmit={enviar} className="space-y-5">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Una vez visada, esta nota <b>no se edita</b>. Si después hace falta corregir o ampliar algo,
        se agrega una adenda fechada. El expediente se conserva diez años desde el cierre.
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-800">Tipo de cierre</label>
        <select
          value={tipoCierre}
          onChange={(e) => setTipoCierre(e.target.value)}
          className={campoClase}
          required
        >
          <option value="">Elegí uno…</option>
          {Object.entries(TIPOS_CIERRE).map(([clave, valor]) => (
            <option key={clave} value={clave}>
              {valor.label}
            </option>
          ))}
        </select>
        {tipo ? <p className="mt-1 text-xs text-slate-500">{tipo.ayuda}</p> : null}
      </div>

      {faltanContactos ? (
        <div className="rounded-xl border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          No hay ningún intento de contacto registrado para esta persona. Antes de dar de baja por
          abandono, registrá al menos uno en la bitácora de reenganche: la diferencia entre
          constatar un abandono y darlo por hecho es justamente ese registro.
        </div>
      ) : null}

      {CAMPOS.map((campo) => (
        <div key={campo.clave}>
          <label className="mb-1 block text-sm font-semibold text-slate-800">{campo.etiqueta}</label>
          <textarea
            rows={4}
            value={valores[campo.clave]}
            onChange={(e) => cambiar(campo.clave, e.target.value)}
            className={campoClase}
            required
          />
          <p className="mt-1 text-xs text-slate-500">{campo.ayuda}</p>
        </div>
      ))}

      {tipo?.requiereReferencia ? (
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">
            Derivación: a quién y con qué indicaciones
          </label>
          <textarea
            rows={3}
            value={valores.referencia}
            onChange={(e) => cambiar("referencia", e.target.value)}
            className={campoClase}
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Una derivación sin destino no es una derivación.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-accent-300 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-900">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !tipoCierre || faltanContactos}
        className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Enviando…" : "Enviar a la dirección clínica"}
      </button>
      <p className="text-xs text-slate-500">
        El cierre queda en firme cuando la dirección clínica lo visa.
      </p>
    </form>
  );
}
