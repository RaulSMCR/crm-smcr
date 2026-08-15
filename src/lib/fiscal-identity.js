// src/lib/fiscal-identity.js
// Identificación fiscal del receptor de una factura electrónica.
//
// Hasta ahora el tipo se adivinaba por el largo del número. Funciona para el
// caso corriente (una cédula física de 9 dígitos) pero se equivoca justo donde
// importa: una cédula jurídica y un NITE tienen ambos 10 dígitos, y quien pide
// factura deducible suele ser precisamente una empresa. Con el tipo declarado
// por la persona, la inferencia queda solo como respaldo para los datos viejos.

/** Códigos de Hacienda para el tipo de identificación. */
export const TIPOS_IDENTIFICACION = Object.freeze({
  FISICA: "01",
  JURIDICA: "02",
  DIMEX: "03",
  NITE: "04",
});

export const ETIQUETAS_IDENTIFICACION = Object.freeze({
  "01": "Cédula física",
  "02": "Cédula jurídica",
  "03": "DIMEX (residencia)",
  "04": "NITE",
});

/** Deja solo dígitos: Hacienda no acepta guiones ni espacios. */
export function limpiarIdentificacion(valor) {
  return String(valor || "").replace(/\D/g, "");
}

/**
 * Tipo deducido del largo. Solo para comprobantes viejos que se guardaron sin
 * tipo declarado; para datos nuevos siempre gana lo que eligió la persona.
 */
export function inferirTipoIdentificacion(idNumber) {
  const limpio = limpiarIdentificacion(idNumber);
  if (!limpio) return null;
  if (limpio.length === 9) return TIPOS_IDENTIFICACION.FISICA;
  if (limpio.length === 10 && limpio.startsWith("3")) return TIPOS_IDENTIFICACION.JURIDICA;
  if (limpio.length === 11 || limpio.length === 12) return TIPOS_IDENTIFICACION.DIMEX;
  return TIPOS_IDENTIFICACION.NITE;
}

/**
 * Comprueba que el número corresponda al tipo declarado.
 *
 * Se valida antes de guardar y no al facturar: un dato incoherente acá se
 * arregla en dos segundos, pero descubierto al emitir deja al paciente sin su
 * comprobante y con el pago ya hecho.
 *
 * @returns {{ok: true, numero: string} | {ok: false, error: string}}
 */
export function validarIdentificacionFiscal(tipo, numero) {
  const limpio = limpiarIdentificacion(numero);
  const codigo = String(tipo || "").trim();

  if (!limpio) return { ok: false, error: "Indique el número de identificación." };
  if (!ETIQUETAS_IDENTIFICACION[codigo]) {
    return { ok: false, error: "Indique el tipo de identificación." };
  }

  if (codigo === TIPOS_IDENTIFICACION.FISICA && limpio.length !== 9) {
    return { ok: false, error: "La cédula física tiene 9 dígitos, sin guiones ni cero al inicio." };
  }
  if (codigo === TIPOS_IDENTIFICACION.JURIDICA) {
    if (limpio.length !== 10) {
      return { ok: false, error: "La cédula jurídica tiene 10 dígitos." };
    }
    if (!limpio.startsWith("3")) {
      return { ok: false, error: "Las cédulas jurídicas empiezan con 3." };
    }
  }
  if (codigo === TIPOS_IDENTIFICACION.DIMEX && (limpio.length < 11 || limpio.length > 12)) {
    return { ok: false, error: "El DIMEX tiene 11 o 12 dígitos." };
  }
  if (codigo === TIPOS_IDENTIFICACION.NITE && limpio.length !== 10) {
    return { ok: false, error: "El NITE tiene 10 dígitos." };
  }

  return { ok: true, numero: limpio };
}

/**
 * Datos con los que emitir la factura de un paciente.
 *
 * Si cargó datos de facturación, mandan esos: es el caso de quien quiere la
 * factura a nombre de su empresa para deducirla. Si no, se usa su propia
 * identidad, que es lo que venía pasando siempre.
 *
 * Los campos de facturación son todo o nada. Un nombre de empresa con la cédula
 * personal produciría un comprobante que no sirve para deducir y que Hacienda
 * igual aceptaría, así que se exige la pareja completa para tomarlos.
 */
export function datosFacturacionDe(user) {
  const billingNumero = limpiarIdentificacion(user?.billingIdNumber);
  const billingNombre = String(user?.billingName || "").trim();
  const usaFacturacion = Boolean(billingNumero && billingNombre);

  if (usaFacturacion) {
    return {
      nombre: billingNombre,
      tipoIdentificacion: user.billingIdType || inferirTipoIdentificacion(billingNumero),
      identificacion: billingNumero,
      correo: String(user?.billingEmail || user?.email || "").trim() || null,
      esDeTercero: true,
    };
  }

  const propio = limpiarIdentificacion(user?.identification);
  return {
    nombre: String(user?.name || "").trim(),
    tipoIdentificacion: propio ? inferirTipoIdentificacion(propio) : null,
    identificacion: propio || null,
    correo: String(user?.email || "").trim() || null,
    esDeTercero: false,
  };
}
