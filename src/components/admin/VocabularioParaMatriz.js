"use client";

import { useMemo, useState } from "react";

/**
 * El vocabulario vivo del sitio, listo para pegar en la matriz editorial.
 *
 * El prompt que se le da a la matriz le pide que clasifique el artículo «con el
 * vocabulario del sitio», pero la matriz no tiene forma de saber cuál es. Si se
 * copia la lista a mano en el documento de instrucciones, queda vieja al primer
 * tema que se agregue acá, y a partir de ahí la matriz propone etiquetas que no
 * existen y la clasificación no se marca sola.
 *
 * Por eso se genera desde la base y se copia de acá: la fuente de verdad es la
 * misma tabla que después tiene que hacer coincidir los nombres.
 */
export default function VocabularioParaMatriz({ disciplines = [], topics = [], phases = [], series = [] }) {
  const [copiado, setCopiado] = useState(false);

  const activos = (lista) => lista.filter((item) => item.isActive !== false).map((item) => item.name);

  const texto = useMemo(() => {
    const bloque = (titulo, nombres) =>
      nombres.length ? `${titulo}:\n${nombres.map((n) => `- ${n}`).join("\n")}` : `${titulo}: (ninguno cargado)`;

    return [
      "Vocabulario de la biblioteca de SaludMentalCR. Usá estos nombres exactos",
      "para clasificar el artículo. Si ninguno sirve, escribí el que falta y",
      'marcalo con "(nuevo)" para que se decida a mano; no inventes etiquetas.',
      "",
      bloque("Disciplinas", activos(disciplines)),
      "",
      bloque("Temas", activos(topics)),
      "",
      bloque("Fases", activos(phases)),
      "",
      bloque("Series", activos(series)),
    ].join("\n");
  }, [disciplines, topics, phases, series]);

  const vacios = [
    !activos(disciplines).length && "disciplinas",
    !activos(topics).length && "temas",
    !activos(phases).length && "fases",
    !activos(series).length && "series",
  ].filter(Boolean);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles queda el textarea, que se puede seleccionar.
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Vocabulario para la matriz editorial</h2>
          <p className="mt-1 text-xs text-slate-600">
            Pegalo en la matriz junto al prompt de metadatos. La matriz clasifica con estos
            nombres y el importador los reconoce solo. Si acá se agrega un tema, hay que volver
            a copiarlo.
          </p>
        </div>
        <button
          type="button"
          onClick={copiar}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>

      {vacios.length ? (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          No hay {vacios.join(", ")} cargados. Mientras estén vacíos, lo que proponga la matriz no
          va a coincidir con nada y la clasificación queda sin marcar.
        </p>
      ) : null}

      <textarea
        readOnly
        value={texto}
        rows={12}
        className="mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800"
      />
    </section>
  );
}
