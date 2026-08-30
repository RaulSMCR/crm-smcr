// src/lib/contratos/numero-en-letras.js
//
// Números en letras para los documentos legales. Un contrato costarricense
// escribe las cifras dos veces —"treinta (30) días"— y esa duplicación no es
// adorno: si el dígito se altera, la palabra lo contradice.
//
// Cubre 0…9999, que es todo lo que un contrato de este tipo necesita: días del
// mes, plazos en días y el año.

const UNIDADES = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte",
];

const DECENAS = [
  "", "", "veinte", "treinta", "cuarenta", "cincuenta",
  "sesenta", "setenta", "ochenta", "noventa",
];

const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

// Los veinti- llevan tilde en 22, 23 y 26, y no se pueden armar pegando el
// prefijo a la unidad.
const VEINTIS = [
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro",
  "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];

function decenasEnLetras(n) {
  if (n <= 20) return UNIDADES[n];
  if (n < 30) return VEINTIS[n - 20];
  const decena = Math.floor(n / 10);
  const unidad = n % 10;
  return unidad === 0 ? DECENAS[decena] : `${DECENAS[decena]} y ${UNIDADES[unidad]}`;
}

function centenasEnLetras(n) {
  if (n === 100) return "cien";
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const cabeza = CENTENAS[centena];
  if (resto === 0) return cabeza;
  return cabeza ? `${cabeza} ${decenasEnLetras(resto)}` : decenasEnLetras(resto);
}

export function numeroEnLetras(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(valor ?? "");
  if (n < 100) return decenasEnLetras(n);
  if (n < 1000) return centenasEnLetras(n);

  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const cabeza = miles === 1 ? "mil" : `${decenasEnLetras(miles)} mil`;
  return resto === 0 ? cabeza : `${cabeza} ${centenasEnLetras(resto)}`;
}

/** "treinta (30)", la forma en que un contrato escribe una cifra. */
export function cifraEnLetrasYNumero(valor) {
  return `${numeroEnLetras(valor)} (${valor})`;
}
