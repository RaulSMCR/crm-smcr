// src/lib/comprobante-sinpe.js
//
// Lee el texto que el OCR sacó de un comprobante SINPE Móvil: monto, fecha y
// referencia. Cada banco lo arma distinto (BN, BCR, BAC, Popular…) y el OCR
// confunde símbolos, así que nada de esto es definitivo: lo que devuelve llena
// campos que la persona revisa antes de facturar. Si un dato no aparece con
// claridad, se devuelve null y se escribe a mano.

const MESES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12,
};

const sinTildes = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * "40.000,00", "40,000.00", "40 000", "40000" → 40000. El separador decimal es
 * el último signo seguido de una o dos cifras; los demás son de miles.
 */
export function normalizarMonto(token) {
  const t = String(token || "").replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const decimal = t.match(/[.,](\d{1,2})$/);
  const entero = (decimal ? t.slice(0, -decimal[0].length) : t).replace(/[.,]/g, "");
  const n = Number(`${entero}.${decimal ? decimal[1] : "0"}`);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const MONTO = /(\d{1,3}(?:[.,\s\u00a0]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
// El OCR lee el símbolo de colón como ₡, ¢, C o «e» pegada a la cifra.
const MONEDA = /(₡|¢|\bCRC\b|\bcolones\b)/i;

const plausible = (n, token) => n && n >= 100 && n < 10_000_000 && !/^\d{8}$/.test(token) && !/^(19|20)\d{2}$/.test(token);

/**
 * El modelo en español no conoce el símbolo ₡ y lo suele leer como un «2»
 * pegado a la cifra: «₡40.000,00» sale «240.000,00». Si la línea no trae ningún
 * otro indicio de moneda y el monto empieza con 2, es improbable para una
 * sesión (₡100 000 o más) y sin ese 2 sigue siendo un monto bien escrito, se
 * toma el de sin el 2 y el otro queda como alternativa para elegirlo a mano.
 */
function montoEn(linea, { exigirMoneda = false } = {}) {
  const conMoneda = MONEDA.test(linea);
  if (exigirMoneda && !conMoneda) return null;
  for (const m of linea.matchAll(MONTO)) {
    const token = m[1].trim();
    const n = normalizarMonto(token);
    if (!plausible(n, token)) continue;
    const previo = linea[m.index - 1];
    const sinDos = token.slice(1);
    if (!conMoneda && n >= 100_000 && token.startsWith("2") && (!previo || /[\s:]/.test(previo))
        && /^\d{1,3}([.,\s]\d{3})+([.,]\d{1,2})?$/.test(sinDos)) {
      const corregido = normalizarMonto(sinDos);
      if (plausible(corregido, sinDos)) return { monto: corregido, alternativo: n };
    }
    return { monto: n, alternativo: null };
  }
  return null;
}

function fechaEn(linea) {
  const t = sinTildes(linea).toLowerCase();
  let m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/);
  if (m) return armarFecha(m[3], m[2], m[1]);
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return armarFecha(m[1], m[2], m[3]);
  m = t.match(/\b(\d{1,2})(?:\s+de)?[\s/-]+([a-z]{3})[a-z]*\.?(?:\s+de)?[\s/-]+(\d{4})\b/);
  if (m && MESES[m[2]]) return armarFecha(m[3], MESES[m[2]], m[1]);
  return null;
}

function armarFecha(anio, mes, dia) {
  const y = Number(anio.length === 2 ? `20${anio}` : anio);
  const mo = Number(mes);
  const d = Number(dia);
  if (y < 2020 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const fecha = new Date(Date.UTC(y, mo - 1, d));
  if (fecha.getUTCMonth() !== mo - 1) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function referenciaEn(linea) {
  // La referencia SINPE es una tira larga de cifras; el OCR a veces la parte.
  const cifras = (linea.match(/\d[\d\s-]{4,}\d/g) || []).map((c) => c.replace(/[\s-]/g, ""));
  const larga = cifras.filter((c) => c.length >= 6 && c.length <= 40).sort((a, b) => b.length - a.length)[0];
  return larga || null;
}

/** Busca en la línea con la palabra clave y, si ahí no está, en la siguiente. */
function buscar(lineas, clave, leer) {
  for (let i = 0; i < lineas.length; i++) {
    if (!clave.test(sinTildes(lineas[i]))) continue;
    const valor = leer(lineas[i].replace(clave, " ")) ?? (lineas[i + 1] ? leer(lineas[i + 1]) : null);
    if (valor) return valor;
  }
  return null;
}

/**
 * @param {string} texto  Lo que devolvió el OCR.
 * @returns {{ monto: number|null, montoAlternativo: number|null, fecha: string|null, referencia: string|null }}
 *   `montoAlternativo`: la otra lectura posible cuando el ₡ pudo leerse como 2.
 *   `fecha` en AAAA-MM-DD, tal como la escribe el comprobante.
 */
export function leerComprobanteSinpe(texto) {
  const lineas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leido = buscar(lineas, /\b(monto|importe|total|valor)\b/i, (l) => montoEn(l))
    ?? lineas.map((l) => montoEn(l, { exigirMoneda: true })).find(Boolean)
    ?? { monto: null, alternativo: null };
  const fecha = buscar(lineas, /\bfecha\b/i, fechaEn) ?? lineas.map(fechaEn).find(Boolean) ?? null;
  // «Referencia» primero: «Comprobante» suele ser el título y su línea siguiente
  // puede traer un teléfono.
  const referencia = buscar(lineas, /\b(referencia|ref)\b/i, referenciaEn)
    ?? buscar(lineas, /\b(transaccion|autorizacion|documento|comprobante)\b/i, referenciaEn);
  return { monto: leido.monto, montoAlternativo: leido.alternativo, fecha, referencia };
}

/**
 * El paciente cuyo nombre aparece en el comprobante (quien envía el SINPE).
 * Solo sugiere si hay uno claro: al menos dos palabras de su nombre y ningún
 * otro con las mismas coincidencias. Es una sugerencia; se elige igual a mano.
 *
 * @param {string} texto
 * @param {{id: string, name: string}[]} pacientes
 */
export function sugerirPaciente(texto, pacientes = []) {
  const palabrasDelTexto = new Set(sinTildes(texto).toUpperCase().match(/[A-ZÑ]{3,}/g) || []);
  const puntajes = pacientes
    .map((p) => ({ id: p.id, puntos: (sinTildes(p.name).toUpperCase().match(/[A-ZÑ]{3,}/g) || []).filter((w) => palabrasDelTexto.has(w)).length }))
    .filter((p) => p.puntos >= 2)
    .sort((a, b) => b.puntos - a.puntos);
  if (!puntajes.length || (puntajes[1] && puntajes[1].puntos === puntajes[0].puntos)) return null;
  return puntajes[0].id;
}
