import { DOMParser } from "@xmldom/xmldom";

/** El JSON de recepción se deriva del XML congelado, incluso si luego cambia la factura. */
export function receptionPayload({ feXml, feClave, feNumber }) {
  if (!feXml || /<!DOCTYPE|<!ENTITY/i.test(feXml)) throw new Error("FE_DOCUMENT_INVALID");
  const doc = new DOMParser({ onError: () => { throw new Error("FE_DOCUMENT_INVALID"); } }).parseFromString(feXml, "text/xml");
  const child = (node, name) => Array.from(node?.childNodes || []).find((el) => el.nodeType === 1 && el.localName === name);
  const value = (node, name) => child(node, name)?.textContent || "";
  const root = doc.documentElement;
  if (value(root, "Clave") !== feClave || value(root, "NumeroConsecutivo") !== feNumber) throw new Error("FE_DOCUMENT_ID_MISMATCH");
  const identity = (name) => {
    const id = child(child(root, name), "Identificacion");
    return id ? { tipoIdentificacion: value(id, "Tipo"), numeroIdentificacion: value(id, "Numero") } : null;
  };
  const emisor = identity("Emisor"), receptor = identity("Receptor"), fecha = value(root, "FechaEmision");
  if (!emisor?.numeroIdentificacion || !fecha) throw new Error("FE_DOCUMENT_INVALID");
  return { clave: feClave, fecha, emisor, ...(receptor ? { receptor } : {}), comprobanteXml: Buffer.from(feXml, "utf8").toString("base64") };
}

/**
 * Guardar antes de contactar al proveedor; dos preparaciones concurrentes adoptan la ganadora.
 *
 * `ambiente` se sella acá, junto con la identidad fiscal, porque es el mismo
 * momento: el comprobante adquiere su clave y su consecutivo bajo un ambiente
 * concreto, y después ya no hay forma de saber cuál era. La clave de Hacienda no
 * lo codifica.
 *
 * @param {string} [ambiente] código de Hacienda: '01' producción, '02' pruebas
 */
export async function persistFeDocument(db, invoiceId, document, { ambiente = null } = {}) {
  await db.invoice.updateMany({ where: {
    id: invoiceId, status: { in: ["OPEN", "PAID"] }, feClave: null, feNumber: null, feXml: null,
  }, data: {
    feClave: document.feClave, feNumber: document.feNumber, feXml: document.feXml,
    ...(ambiente ? { feAmbiente: ambiente } : {}),
  } });
  const saved = await db.invoice.findUnique({ where: { id: invoiceId }, select: { status: true, feClave: true, feNumber: true, feXml: true, feAmbiente: true } });
  if (!saved || !["OPEN", "PAID"].includes(saved.status) || !saved.feClave || !saved.feNumber || !saved.feXml) {
    throw new Error("FE_DOCUMENT_REVIEW_REQUIRED");
  }
  receptionPayload(saved);
  return saved;
}
