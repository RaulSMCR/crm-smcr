// src/lib/iban.js
//
// La cuenta a la que se le transfieren los honorarios al profesional.
//
// Se valida de verdad y no solo por largo: un IBAN mal tipeado no rebota, va a
// parar a otra cuenta o a ninguna, y el error aparece días después cuando
// alguien reclama que no le llegó la liquidación. Los dos dígitos de control del
// IBAN existen justamente para atajar el dedo equivocado, y comprobarlos cuesta
// diez líneas.
//
// Se acepta cualquier IBAN (un profesional puede tener cuenta fuera del país),
// pero el de Costa Rica se reconoce aparte porque es el caso normal y su forma
// es fija: CR + 2 dígitos de control + 18 dígitos = 22 caracteres.

const LARGO_IBAN_CR = 22;

/** Sin espacios ni guiones, en mayúsculas. Es la forma en que se guarda. */
export function normalizarIban(valor) {
  return String(valor || "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

/** "CR05 0152 0200 1026 2840 66" — como lo imprime el banco, para leerlo. */
export function formatearIban(valor) {
  const limpio = normalizarIban(valor);
  return limpio.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Resto de dividir el IBAN entre 97, calculado de a pedazos porque el número
 * completo no cabe en un entero de JavaScript.
 */
function modulo97(iban) {
  // El IBAN se rota (los 4 primeros al final) y cada letra pasa a ser su
  // posición en el alfabeto más 9: A=10, B=11… Z=35.
  const rotado = iban.slice(4) + iban.slice(0, 4);
  const enDigitos = rotado.replace(/[A-Z]/g, (letra) => String(letra.charCodeAt(0) - 55));

  let resto = 0;
  for (const digito of enDigitos) {
    resto = (resto * 10 + Number(digito)) % 97;
  }
  return resto;
}

/**
 * @returns {{valido: boolean, iban: string, error: string|null, esCostaRica: boolean}}
 */
export function validarIban(valor) {
  const iban = normalizarIban(valor);

  if (!iban) {
    return { valido: false, iban: "", error: "Falta el número de cuenta IBAN.", esCostaRica: false };
  }
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
    return {
      valido: false,
      iban,
      error: "El IBAN empieza con dos letras del país y dos dígitos de control, por ejemplo CR21…",
      esCostaRica: false,
    };
  }
  if (iban.length < 15 || iban.length > 34) {
    return { valido: false, iban, error: "El IBAN no tiene un largo válido.", esCostaRica: false };
  }

  const esCostaRica = iban.startsWith("CR");
  if (esCostaRica && iban.length !== LARGO_IBAN_CR) {
    return {
      valido: false,
      iban,
      error: `Un IBAN de Costa Rica tiene ${LARGO_IBAN_CR} caracteres y este tiene ${iban.length}.`,
      esCostaRica,
    };
  }

  if (modulo97(iban) !== 1) {
    return {
      valido: false,
      iban,
      error: "Los dígitos de control del IBAN no cuadran. Revise que esté completo y sin errores de tipeo.",
      esCostaRica,
    };
  }

  return { valido: true, iban, error: null, esCostaRica };
}
