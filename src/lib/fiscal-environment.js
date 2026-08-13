// src/lib/fiscal-environment.js
// Coherencia entre el ambiente de cobro (ONVO) y el fiscal (Hacienda).
//
// El problema que resuelve: la URL de ONVO es la misma en pruebas y en vivo, así
// que nada en la configuración delata en cuál se está. Solo lo dice el prefijo
// de la llave. Una llave `live` en un deploy de pruebas cobra dinero de verdad
// sin ninguna señal.
//
// Las dos combinaciones incoherentes tienen consecuencias distintas y ninguna es
// aceptable:
//
//   ONVO live + Hacienda pruebas -> se cobra dinero real y el comprobante que se
//       emite no tiene validez tributaria. El paciente pagó y no hay factura.
//   ONVO pruebas + Hacienda producción -> se emiten comprobantes fiscales reales
//       respaldados por cobros que nunca ocurrieron.
//
// Por eso se aborta la operación en vez de continuar. La comprobación se ejecuta
// al crear un cobro y al emitir una factura, no al importar el módulo: así no
// puede saltearse por un import perezoso ni romper el build de Next.

/** Ambiente que declara la llave secreta de ONVO. */
export function detectarAmbienteOnvo(secretKey) {
  const llave = String(secretKey || "").trim();
  if (llave.startsWith("onvo_live_")) return "produccion";
  if (llave.startsWith("onvo_test_")) return "pruebas";
  return null;
}

/** Ambiente que declara FE_AMBIENTE: 01 es producción, 02 es pruebas. */
export function detectarAmbienteFe(feAmbiente) {
  const valor = String(feAmbiente || "").trim();
  if (valor === "01") return "produccion";
  if (valor === "02") return "pruebas";
  return null;
}

/**
 * Aborta si el ambiente de cobro y el fiscal no coinciden.
 *
 * Si falta cualquiera de los dos no se opina: de eso ya se encargan
 * assertFeConfig() y la propia creación del enlace de pago.
 *
 * Durante el corte puede hacer falta convivir con ambientes distintos a
 * propósito (por ejemplo, cobrar en pruebas mientras se habilita Hacienda en
 * producción). Para eso está FISCAL_AMBIENTE_MIXTO=1, deliberadamente
 * incómoda de escribir para que nadie la deje puesta sin querer.
 */
export function assertAmbientesCoherentes({
  onvoKey = process.env.ONVO_SECRET_KEY,
  feAmbiente = process.env.FE_AMBIENTE,
  permitirMixto = process.env.FISCAL_AMBIENTE_MIXTO === "1",
} = {}) {
  const ambienteOnvo = detectarAmbienteOnvo(onvoKey);
  const ambienteFe = detectarAmbienteFe(feAmbiente);

  if (!ambienteOnvo || !ambienteFe) return { ok: true, motivo: "indeterminado" };
  if (ambienteOnvo === ambienteFe) return { ok: true, ambiente: ambienteOnvo };

  if (permitirMixto) {
    console.warn(
      `[fiscal] Ambientes mezclados a propósito: cobros en ${ambienteOnvo}, ` +
        `facturación en ${ambienteFe} (FISCAL_AMBIENTE_MIXTO=1).`
    );
    return { ok: true, mixto: true };
  }

  const detalle =
    ambienteOnvo === "produccion"
      ? "se cobraría dinero real y el comprobante no tendría validez tributaria"
      : "se emitirían comprobantes fiscales reales por cobros que no ocurrieron";

  throw new Error(
    `Configuración incoherente: ONVO está en ${ambienteOnvo} (ONVO_SECRET_KEY) y ` +
      `Hacienda en ${ambienteFe} (FE_AMBIENTE=${feAmbiente}). Así ${detalle}. ` +
      "Alinee ambas variables. Si la mezcla es intencional durante una transición, " +
      "declare FISCAL_AMBIENTE_MIXTO=1."
  );
}
