// src/lib/fe/client.js
// Orquesta el flujo completo de envío a Hacienda CR:
//   generateXml → signXml → submit → poll

import { FE_API } from "./config.js";
import { getFeToken, invalidateFeToken } from "./auth.js";
import { generateFeXml } from "./xml.js";
import { signXml } from "./signer.js";
import { receptionPayload } from "./document.js";

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 6; // max 30s de espera

/**
 * Envía una factura a Hacienda CR y espera el resultado (polling).
 *
 * @param {object} invoice  - Invoice con todos los campos + lines cargados
 * @param {object[]} lines  - invoice.lines (ya incluidas en invoice.lines normalmente)
 * @returns {Promise<{ feNumber, feClave, feStatus, feErrorMessage }>}
 */
export async function submitToHacienda(invoice, lines, { persistDocument, pollAttempts = 6 } = {}) {
  let document;
  if (invoice.feXml && invoice.feClave && invoice.feNumber) {
    document = { feXml: invoice.feXml, feClave: invoice.feClave, feNumber: invoice.feNumber };
  } else {
    // Una identidad parcial puede pertenecer a un envío antiguo. No sustituirla.
    if (invoice.feXml || invoice.feClave || invoice.feNumber) throw new Error("FE_DOCUMENT_REVIEW_REQUIRED");
    const { xml, feNumber, feClave } = generateFeXml(invoice, lines || invoice.lines || []);
    document = { feNumber, feClave, feXml: await signXml(xml, FE_API.p12Base64, FE_API.p12Pin) };
  }
  // El orquestador del CRM proporciona esta persistencia antes de cualquier petición.
  if (persistDocument) document = await persistDocument(document);
  const payload = receptionPayload(document);
  const token = await getFeToken();
  const known = await queryStatus(document.feClave, token);
  if (known) return feResult(known, document);

  const response = await fetchWithToken(`${FE_API.recepcionUrl}/recepcion`, token, {
    method: "POST", body: JSON.stringify(payload),
  });
  if (!response.ok) {
    if (response.status === 401) invalidateFeToken();
    // Puede ser un envío concurrente o una recepción cuya respuesta se perdió.
    const received = await queryStatus(document.feClave, token);
    if (received) return feResult(received, document);
    const error = errorFe("FE_SUBMISSION_FAILED", response);
    error.reviewRequired = [400, 403, 422].includes(response.status);
    throw error;
  }
  return feResult(await pollStatus(document.feClave, token, { maxAttempts: pollAttempts }), document);
}

export function feResult(result, document = {}) {
  const state = estadoDe(result);
  const feStatus = state === "aceptado" ? "ACCEPTED" : state === "rechazado" ? "REJECTED" : "PENDING";
  return {
    feNumber: document.feNumber || null, feClave: document.feClave || null,
    feStatus, feErrorMessage: feStatus === "REJECTED" ? describirRechazo(result)
      : feStatus === "PENDING" ? "Comprobante pendiente de confirmación de Hacienda." : null,
    signedXml: document.feXml || null, respuestaXml: decodificarRespuesta(result),
    avisos: feStatus === "ACCEPTED" ? describirRechazo(result) : null,
    reviewRequired: state === "error", haciendaStatus: state,
  };
}

/**
 * Lo que Hacienda explica en el encabezado `X-Error-Cause`.
 *
 * Hace falta porque los errores de la consulta de estado llegan con
 * `content-length: 0`: el cuerpo está vacío y el único texto que dice algo viaja
 * en ese encabezado (verificado el 2026-10-19 contra api-sandbox, que responde
 * «El comprobante [<clave>] no ha sido recibido.» con HTTP 400). Sin leerlo, una
 * factura trabada solo decía FE_STATUS_UNAVAILABLE.
 *
 * Se sanea y se recorta: es un mensaje operativo corto, no el `respuesta-xml`,
 * que sí puede traer el detalle del documento línea por línea y no se publica.
 */
export function causaHacienda(response) {
  return String(response?.headers?.get?.("x-error-cause") || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/**
 * ¿Hacienda está diciendo que no tiene este comprobante?
 *
 * La consulta de estado NO responde 404 cuando no lo encuentra: responde 400 con
 * el cuerpo vacío y el motivo en `X-Error-Cause`. Verificado el 2026-10-19
 * contra api-sandbox, idéntico para una clave real y para una inexistente:
 *
 *   HTTP 400 · x-error-cause: El comprobante [<clave>] no ha sido recibido.
 *
 * Esto importaba mucho más de lo que parece. La consulta corre ANTES del POST a
 * /recepcion, para no enviar dos veces un comprobante cuya respuesta se perdió.
 * Al tratar ese 400 como un fallo de comunicación, la salvaguarda abortaba la
 * emisión en vez de habilitarla: ningún comprobante podía enviarse nunca, y la
 * factura quedaba PENDING reintentando hasta agotar los doce intentos.
 *
 * Se exige el texto Y que mencione la clave consultada, no el 400 a secas, por
 * dos razones: un 400 puede significar otra cosa —y entonces seguir hacia el
 * POST sería temerario—, y el encabezado `clave` que acompaña a la respuesta
 * confirma que el mensaje habla de nuestro comprobante. Si Hacienda cambiara la
 * redacción, la condición deja de cumplirse y se vuelve a lanzar: falla cerrado,
 * nunca hacia un envío doble.
 */
function noRecibido(response, clave) {
  const causa = causaHacienda(response);
  return /no ha sido recibido/i.test(causa) && causa.includes(String(clave));
}

/** Error con la explicación de Hacienda adjunta, para que el orquestador la guarde. */
function errorFe(code, response) {
  const error = new Error(code);
  const causa = causaHacienda(response);
  if (causa) error.causaHacienda = causa;
  return error;
}

async function queryStatus(clave, token) {
  const response = await fetchWithToken(`${FE_API.recepcionUrl}/recepcion/${clave}`, token, { method: "GET" });
  if (response.status === 404) return null;
  // Hacienda dice «no lo tengo» con un 400, no con un 404. Ver noRecibido().
  if (response.status === 400 && noRecibido(response, clave)) return null;
  if (!response.ok) {
    if (response.status === 401) invalidateFeToken();
    throw errorFe("FE_STATUS_UNAVAILABLE", response);
  }
  return response.json();
}

/** Devuelve el XML de respuesta de Hacienda ya decodificado, o null. */
function decodificarRespuesta(result) {
  const b64 = result?.["respuesta-xml"] || result?.respuesta_xml;
  if (!b64) return null;
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Estado del comprobante. Hacienda responde con `ind-estado` (con guion); se
 * acepta también la variante con guion bajo por si cambia la API.
 *
 * Leerlo mal es silencioso y caro: la factura queda REJECTED aunque Hacienda la
 * haya aceptado, y el polling agota todos sus intentos en cada envío.
 */
function estadoDe(result) {
  return String(result?.["ind-estado"] ?? result?.ind_estado ?? "").toLowerCase();
}

/**
 * Motivo legible del rechazo. Hacienda manda `respuesta-xml` en base64 con el
 * detalle adentro; sin decodificarlo el admin solo veía "Rechazado por Hacienda"
 * y no tenía forma de saber qué corregir.
 */
function describirRechazo(result) {
  const b64 = result?.["respuesta-xml"] || result?.respuesta_xml;

  if (b64) {
    try {
      const xml = Buffer.from(b64, "base64").toString("utf8");
      const detalle = /<DetalleMensaje>([\s\S]*?)<\/DetalleMensaje>/.exec(xml);
      if (detalle?.[1]) {
        return detalle[1]
          .replace(/&#13;/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 900);
      }
      return xml.slice(0, 900);
    } catch {
      // Si no se puede decodificar, se sigue de largo al mensaje genérico.
    }
  }

  return result?.mensaje || "Rechazado por Hacienda";
}

/**
 * Consulta el estado de un comprobante en Hacienda.
 * @param {string} clave  - Clave de 50 dígitos
 * @param {string|null} existingToken - Token ya obtenido (opcional)
 * @returns {Promise<{ ind_estado: string, respuesta_xml?: string, mensaje?: string }>}
 */
export async function pollStatus(clave, existingToken = null, { maxAttempts = POLL_MAX_ATTEMPTS } = {}) {
  const token = existingToken || (await getFeToken());

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetchWithToken(
      `${FE_API.recepcionUrl}/recepcion/${clave}`,
      token,
      { method: "GET" }
    );

    if (!res.ok) {
      // El 400 con «no ha sido recibido» es el mismo caso que el 404: después
      // del envío significa que Hacienda todavía no lo registró, así que se
      // sigue sondeando en vez de darlo por perdido.
      if (res.status === 404 || (res.status === 400 && noRecibido(res, clave))) {
        // Aún no procesado
        if (attempt < maxAttempts) {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        return { ind_estado: "procesando", mensaje: "Timeout: comprobante aún en procesamiento" };
      }
      if (res.status === 401) invalidateFeToken();
      throw errorFe("FE_STATUS_UNAVAILABLE", res);
    }

    const data = await res.json();
    const estado = estadoDe(data);

    if (["recibido", "procesando", ""].includes(estado)) {
      if (attempt < maxAttempts) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
    }
    return data;
  }

  return { ind_estado: "procesando", mensaje: "Timeout: comprobante aún en procesamiento" };
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function fetchWithToken(url, token, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
