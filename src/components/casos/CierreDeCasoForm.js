"use client";

// Cierre administrativo de un proceso.
//
// No hay ningún campo de relato, y no debe agregarse. Cómo evolucionó el
// proceso y cómo llega la persona al cierre son contenido de expediente, y el
// expediente le pertenece a ella y a su profesional, que es su custodio. Acá
// solo se declara el hecho administrativo: qué categoría, si se le avisó, y a
// dónde va si se deriva.
//
// Las casillas no son burocracia: son lo que respalda al profesional y a la
// empresa el día que alguien pregunte por qué se cerró un proceso.
//
// La baja por abandono es la única que exige algo previo —al menos un intento de
// contacto registrado— y la única que no exige haber informado a la persona: no
// haberla podido ubicar es justamente su definición.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proponerCierre } from "@/actions/caso-actions";
import { TIPOS_CIERRE } from "@/lib/casos-policy";

export default function CierreDeCasoForm({ casoId, contactosDeReenganche }) {
  const router = useRouter();
  const [tipoCierre, setTipoCierre] = useState("");
  const [personaInformada, setPersonaInformada] = useState(false);
  const [registradoEnExpediente, setRegistradoEnExpediente] = useState(false);
  const [derivadoA, setDerivadoA] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const tipo = useMemo(() => TIPOS_CIERRE[tipoCierre] || null, [tipoCierre]);
  const faltanContactos = Boolean(tipo?.requiereContactos) && contactosDeReenganche < 1;
  const faltaAviso = Boolean(tipo) && !personaInformada && !tipo.permiteSinAviso;
  const faltaDestino = Boolean(tipo?.requiereDestino) && derivadoA.trim().length < 3;

  const puedeEnviar =
    Boolean(tipo) && registradoEnExpediente && !faltanContactos && !faltaAviso && !faltaDestino;

  function enviar(e) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await proponerCierre(casoId, {
        tipoCierre,
        personaInformada,
        registradoEnExpediente,
        derivadoA,
      });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const campoClase =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-400";
  const casillaClase =
    "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-400";

  return (
    <form onSubmit={enviar} className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        Acá se registra <b>solo el dato administrativo</b> del cierre. El expediente clínico es tuyo
        y de la persona: nada de lo que escribas en él pasa por esta plataforma, y su custodia
        sigue siendo tuya.
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

      {tipo?.requiereDestino ? (
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">A quién se deriva</label>
          <input
            type="text"
            value={derivadoA}
            onChange={(e) => setDerivadoA(e.target.value)}
            placeholder="Nombre del profesional o servicio"
            maxLength={200}
            className={campoClase}
          />
          <p className="mt-1 text-xs text-slate-500">
            Solo el destino. Las indicaciones van en tu expediente, no acá.
          </p>
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-800">Antes de enviar</legend>

        {tipo?.permiteSinAviso ? null : (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={personaInformada}
              onChange={(e) => setPersonaInformada(e.target.checked)}
              className={casillaClase}
            />
            <span>La persona fue informada del cierre de su proceso.</span>
          </label>
        )}

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={registradoEnExpediente}
            onChange={(e) => setRegistradoEnExpediente(e.target.checked)}
            className={casillaClase}
          />
          <span>El cierre quedó registrado en el expediente que llevo de esta persona.</span>
        </label>
      </fieldset>

      {error ? (
        <p className="rounded-xl border border-accent-300 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-900">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !puedeEnviar}
        className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Enviando…" : "Enviar a la dirección clínica"}
      </button>
      <p className="text-xs text-slate-500">
        El cierre queda en firme cuando la dirección clínica lo visa. Es un control del negocio, no
        una supervisión de tu práctica.
      </p>
    </form>
  );
}
