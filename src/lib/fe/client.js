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
    const error = new Error("FE_SUBMISSION_FAILED");
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

async function queryStatus(clave, token) {
  const response = await fetchWithToken(`${FE_API.recepcionUrl}/recepcion/${clave}`, token, { method: "GET" });
  if (response.status === 404) return null;
  if (!response.ok) {
    if (response.status === 401) invalidateFeToken();
    throw new Error("FE_STATUS_UNAVAILABLE");
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
      if (res.status === 404) {
        // Aún no procesado
        if (attempt < maxAttempts) {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        return { ind_estado: "procesando", mensaje: "Timeout: comprobante aún en procesamiento" };
      }
      if (res.status === 401) invalidateFeToken();
      throw new Error("FE_STATUS_UNAVAILABLE");
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
