// src/lib/fe/client.js
// Orquesta el flujo completo de envío a Hacienda CR:
//   generateXml → signXml → submit → poll

import { FE_API, FE_EMISOR } from "./config.js";
import { getFeToken, invalidateFeToken } from "./auth.js";
import { generateFeXml } from "./xml.js";
import { signXml } from "./signer.js";

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 6; // max 30s de espera

/**
 * Envía una factura a Hacienda CR y espera el resultado (polling).
 *
 * @param {object} invoice  - Invoice con todos los campos + lines cargados
 * @param {object[]} lines  - invoice.lines (ya incluidas en invoice.lines normalmente)
 * @returns {Promise<{ feNumber, feClave, feStatus, feErrorMessage }>}
 */
export async function submitToHacienda(invoice, lines) {
  // 1. Generar XML
  const { xml, feNumber, feClave } = generateFeXml(invoice, lines || invoice.lines || []);

  // 2. Firmar XML
  const signedXml = await signXml(xml, FE_API.p12Base64, FE_API.p12Pin);

  // 3. Codificar en base64
  const xmlB64 = Buffer.from(signedXml, "utf8").toString("base64");

  // 4. Obtener token
  const token = await getFeToken();

  // 5. Construir payload para la API de recepción
  const invoiceDate = invoice.invoiceDate instanceof Date
    ? invoice.invoiceDate
    : new Date(invoice.invoiceDate);
  const pad = (n) => String(n).padStart(2, "0");
  const fechaStr =
    `${invoiceDate.getFullYear()}-${pad(invoiceDate.getMonth() + 1)}-${pad(invoiceDate.getDate())}` +
    `T${pad(invoiceDate.getHours())}:${pad(invoiceDate.getMinutes())}:${pad(invoiceDate.getSeconds())}-06:00`;

  const payload = {
    clave: feClave,
    fecha: fechaStr,
    emisor: {
      tipoIdentificacion: FE_EMISOR.tipoIdentificacion,
      numeroIdentificacion: FE_EMISOR.identificacion,
    },
    comprobanteXml: xmlB64,
  };

  // Receptor si hay identificación
  if (invoice.contactIdNumber) {
    const clean = String(invoice.contactIdNumber).replace(/\D/g, "");
    const tipo = clean.length === 9 ? "01"
      : clean.length === 10 ? "02"
      : clean.length >= 11 ? "03"
      : null;
    if (tipo) {
      payload.receptor = { tipoIdentificacion: tipo, numeroIdentificacion: clean };
    }
  }

  // 6. POST a la API de recepción
  const submitRes = await fetchWithToken(
    `${FE_API.recepcionUrl}/recepcion`,
    token,
    { method: "POST", body: JSON.stringify(payload) }
  );

  // La API de recepción devuelve 201/202 si aceptó la solicitud de procesamiento
  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => "");
    // Si el token expiró, invalidar cache y relanzar
    if (submitRes.status === 401) {
      invalidateFeToken();
      throw new Error("[FE] Token expirado al enviar. Reintente.");
    }
    throw new Error(`[FE] Error ${submitRes.status} al enviar comprobante: ${errText}`);
  }

  // 7. Polling del estado
  const result = await pollStatus(feClave, token);

  return {
    feNumber,
    feClave,
    feStatus:       result.ind_estado === "aceptado" ? "ACCEPTED" : "REJECTED",
    feErrorMessage: result.ind_estado !== "aceptado"
      ? (result.respuesta_xml || result.mensaje || "Rechazado por Hacienda")
      : null,
  };
}

/**
 * Consulta el estado de un comprobante en Hacienda.
 * @param {string} clave  - Clave de 50 dígitos
 * @param {string|null} existingToken - Token ya obtenido (opcional)
 * @returns {Promise<{ ind_estado: string, respuesta_xml?: string, mensaje?: string }>}
 */
export async function pollStatus(clave, existingToken = null) {
  const token = existingToken || (await getFeToken());

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
    const res = await fetchWithToken(
      `${FE_API.recepcionUrl}/recepcion/${clave}`,
      token,
      { method: "GET" }
    );

    if (!res.ok) {
      if (res.status === 404) {
        // Aún no procesado
        if (attempt < POLL_MAX_ATTEMPTS) {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        return { ind_estado: "procesando", mensaje: "Timeout: comprobante aún en procesamiento" };
      }
      const errText = await res.text().catch(() => "");
      throw new Error(`[FE] Error ${res.status} consultando estado: ${errText}`);
    }

    const data = await res.json();
    const estado = (data.ind_estado || "").toLowerCase();

    if (estado === "procesando" || estado === "") {
      if (attempt < POLL_MAX_ATTEMPTS) {
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
