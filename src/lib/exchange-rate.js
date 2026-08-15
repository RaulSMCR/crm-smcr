// src/lib/exchange-rate.js
// Tipo de cambio del dólar, con caché diaria y respaldo explícito.
//
// Por qué existe: ONVO cobra su fijo por transacción en dólares (US$0.35) y su
// liquidación llega convertida con SU tipo de cambio del día. Si acá se usa un
// número distinto cada vez, o uno que cambia sin dejar rastro, la diferencia
// entre lo estimado y lo cobrado no se puede explicar.
//
// Lo que este módulo garantiza: dentro de un mismo día, todas las transacciones
// usan EXACTAMENTE el mismo valor, y ese valor queda guardado junto con su
// origen. Nunca falla: si no consigue el dato, degrada por una cadena conocida
// en vez de tirar una excepción en medio de un cobro.
//
// Sobre las fuentes automáticas: tanto el BCCR como el indicador del Ministerio
// de Hacienda restringen el acceso por ubicación geográfica y responden 403/503
// desde fuera de Costa Rica. Las funciones de Vercel corren en pdx1 (Portland),
// así que la descarga automática puede no funcionar nunca en producción. Por eso
// la carga manual no es un parche: es el camino que se espera que se use, y el
// automático es la comodidad si algún día responde.

import { prisma } from "@/lib/prisma";

/** Último recurso, si no hay dato guardado ni variable configurada. */
export const TIPO_CAMBIO_FALLBACK = 510;

export const FUENTES = Object.freeze({
  BCCR: "BCCR",
  HACIENDA: "HACIENDA",
  MANUAL: "MANUAL",
  FALLBACK: "FALLBACK",
});

/** Medianoche de hoy en Costa Rica, como fecha UTC para la columna DATE. */
export function diaDeHoyCR(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
  return new Date(`${partes}T00:00:00.000Z`);
}

/**
 * Descarga el tipo de cambio del indicador del Ministerio de Hacienda.
 *
 * Devuelve null ante cualquier problema —incluido el bloqueo geográfico, que
 * responde una página HTML con estado 200— en vez de lanzar: quien llama está
 * en medio de un cobro y no puede romperse por esto.
 */
async function descargarDeHacienda() {
  try {
    const res = await fetch("https://api.hacienda.go.cr/indicadores/tc/dolar", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    // El bloqueo geográfico devuelve HTML con 200. Sin esta comprobación,
    // JSON.parse fallaría con un mensaje que no dice nada del problema real.
    const tipo = res.headers.get("content-type") || "";
    if (!tipo.includes("json")) return null;

    const datos = await res.json();
    const venta = Number(datos?.venta?.valor);
    const compra = Number(datos?.compra?.valor);
    if (!Number.isFinite(venta) || venta <= 0) return null;

    return { sell: venta, buy: Number.isFinite(compra) ? compra : null, source: FUENTES.HACIENDA };
  } catch {
    return null;
  }
}

/** Lo que diga la variable de entorno, si es un número usable. */
function delEntorno() {
  const valor = Number(process.env.USD_CRC_RATE);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

/**
 * Tipo de cambio de venta vigente hoy.
 *
 * Orden: lo guardado para hoy → descarga → la variable de entorno → el último
 * valor conocido → el fallback. Los dos últimos escalones importan: es preferible
 * usar el valor de ayer, que estará a centavos del de hoy, antes que un número
 * fijo escrito hace meses.
 *
 * @returns {Promise<{rate: number, source: string, date: Date, esDeHoy: boolean}>}
 */
export async function obtenerTipoCambio({ permitirDescarga = true } = {}) {
  const hoy = diaDeHoyCR();

  const guardado = await prisma.exchangeRate.findUnique({ where: { date: hoy } });
  if (guardado) {
    return { rate: Number(guardado.sell), source: guardado.source, date: hoy, esDeHoy: true };
  }

  if (permitirDescarga) {
    const descargado = await descargarDeHacienda();
    if (descargado) {
      const fila = await prisma.exchangeRate.upsert({
        where: { date: hoy },
        create: { date: hoy, ...descargado },
        update: { sell: descargado.sell, buy: descargado.buy, source: descargado.source },
      });
      return { rate: Number(fila.sell), source: fila.source, date: hoy, esDeHoy: true };
    }
  }

  const configurado = delEntorno();
  if (configurado) {
    return { rate: configurado, source: "USD_CRC_RATE", date: hoy, esDeHoy: false };
  }

  const ultimo = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
  if (ultimo) {
    return { rate: Number(ultimo.sell), source: ultimo.source, date: ultimo.date, esDeHoy: false };
  }

  return { rate: TIPO_CAMBIO_FALLBACK, source: FUENTES.FALLBACK, date: hoy, esDeHoy: false };
}

/**
 * Guarda el tipo de cambio de un día a mano.
 *
 * Es el camino esperado mientras la descarga automática siga bloqueada por
 * ubicación. Sobrescribe lo que hubiera: un dato cargado por una persona vale
 * más que uno adivinado por la cadena de respaldo.
 */
export async function registrarTipoCambioManual({ sell, buy = null, fecha, createdBy = null }) {
  const valor = Number(sell);
  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: "El tipo de cambio debe ser un número mayor que cero." };
  }
  // Un dedazo de un cero cambiaría todas las conversiones del día sin que nada
  // lo delate, así que se acota a un rango donde el colón se ha movido siempre.
  if (valor < 100 || valor > 2000) {
    return { error: "Ese valor está fuera de rango. Revisá que sean colones por dólar." };
  }

  const dia = fecha ? diaDeHoyCR(new Date(fecha)) : diaDeHoyCR();
  const compra = Number(buy);

  const fila = await prisma.exchangeRate.upsert({
    where: { date: dia },
    create: {
      date: dia,
      sell: valor,
      buy: Number.isFinite(compra) && compra > 0 ? compra : null,
      source: FUENTES.MANUAL,
      createdBy,
    },
    update: {
      sell: valor,
      buy: Number.isFinite(compra) && compra > 0 ? compra : null,
      source: FUENTES.MANUAL,
      createdBy,
    },
  });

  return { success: true, rate: Number(fila.sell), date: fila.date };
}
