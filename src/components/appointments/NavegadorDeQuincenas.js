"use client";

import {
  crAddDays,
  crDay,
  DIAS_HACIA_ADELANTE,
  DIAS_POR_TANDA,
  formatDayTab,
  instanteDeHoraCR,
} from "@/lib/appointment-slots";

/** El primer día de la última tanda que todavía entra en la ventana. */
function ultimaTanda() {
  return crAddDays(crDay(new Date()), DIAS_HACIA_ADELANTE - DIAS_POR_TANDA);
}

/**
 * «← Anteriores | 3 nov – 16 nov | Siguientes →». Sin esto, el selector
 * mostraba solo los próximos catorce días y no había forma de agendar a un
 * paciente quincenal o mensual más allá.
 */
export default function NavegadorDeQuincenas({ desde, onChange }) {
  const hoy = crDay(new Date());
  const hasta = crAddDays(desde, DIAS_POR_TANDA - 1);
  const puedeRetroceder = desde > hoy;
  const puedeAvanzar = desde < ultimaTanda();

  const mover = (dias) => {
    const destino = crAddDays(desde, dias);
    // Las fechas 'YYYY-MM-DD' se comparan bien como texto.
    if (destino < hoy) onChange(hoy);
    else if (destino > ultimaTanda()) onChange(ultimaTanda());
    else onChange(destino);
  };

  const boton =
    "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" className={boton} disabled={!puedeRetroceder} onClick={() => mover(-DIAS_POR_TANDA)}>
        ← Anteriores
      </button>
      <span className="text-xs font-medium text-slate-600">
        {formatDayTab(instanteDeHoraCR(desde))} – {formatDayTab(instanteDeHoraCR(hasta))}
      </span>
      <button type="button" className={boton} disabled={!puedeAvanzar} onClick={() => mover(DIAS_POR_TANDA)}>
        Siguientes →
      </button>
    </div>
  );
}
