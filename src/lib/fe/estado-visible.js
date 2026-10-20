// src/lib/fe/estado-visible.js
//
// Qué muestra la columna FE del listado de facturas y qué acciones ofrece cada
// fila. Vive aparte del componente para que estas reglas —que son fiscales, no
// de diseño— tengan pruebas propias.

/**
 * El estado FE que se le muestra a una persona.
 *
 * `feStatus` vale PENDING por defecto en la base, también en una factura que
 * nunca se envió. Mostrar «PENDING» ahí daría a entender que Hacienda la tiene
 * en proceso. Lo que distingue «se envió» de «no se envió» es la clave: sin
 * clave no hubo comprobante, y eso es SIN_ENVIAR.
 *
 * @param {{ feStatus?: string|null, feClave?: string|null }} row
 */
export function estadoFeVisible(row = {}) {
  if (!row.feClave) return "SIN_ENVIAR";
  return row.feStatus || "PENDING";
}

/**
 * Qué acciones fiscales corresponden a una fila del listado.
 *
 * Dos invariantes de Hacienda gobiernan esto y no son negociables:
 *
 *   1. Una clave rechazada es definitiva. Reenviarla o reconsultarla devuelve
 *      siempre el mismo veredicto, así que «Enviar FE» sobre una rechazada no
 *      puede arreglar nada. Lo que corresponde es reemitir con consecutivo y
 *      clave nuevos.
 *   2. Una nota de crédito rectifica un comprobante que Hacienda ACEPTÓ. A uno
 *      rechazado —o que nunca se envió— no le corresponde, porque nunca tuvo
 *      validez. Ofrecerla ahí es una trampa: emite un documento fiscal que
 *      anula algo inexistente.
 *
 * La regla de la nota de crédito vale para las facturas que emitimos. Las de
 * proveedor no pasan por nuestro envío a Hacienda —su `feStatus` nunca llega a
 * ACCEPTED— y conservan la regla que tenían.
 *
 * @param {{ invoiceType?: string, status?: string, feStatus?: string|null, feClave?: string|null }} row
 */
export function accionesFe(row = {}) {
  const deCliente = row.invoiceType === "CUSTOMER_INVOICE";
  const validada = row.status === "OPEN" || row.status === "PAID";
  const estado = estadoFeVisible(row);
  const aceptada = estado === "ACCEPTED";
  const rechazada = estado === "REJECTED";

  return {
    enviar: validada && !aceptada && !rechazada,
    // ACCEPTED y REJECTED son veredictos finales: no hay nada que reconsultar.
    consultar: estado === "PENDING",
    notaCredito: row.status === "PAID" && (deCliente ? aceptada : true),
    reemitir: deCliente && validada && rechazada,
  };
}
