// src/lib/cuentas-de-cobro.js
//
// Por dónde entró el dinero cuando el cobro NO pasó por ONVO.
//
// ONVO deja su propio rastro —enlace y evento quedan en la factura— y de ahí se
// deduce el medio de pago sin preguntarle a nadie. Un cobro que el
// administrador reporta a mano no trae nada: alguien pagó en efectivo, por
// SINPE Móvil o transfirió, y si no se anota en el momento no hay forma de
// reconstruirlo después contra el estado de cuenta.
//
// Son dos datos distintos y por eso viajan juntos acá:
//
//   • la CUENTA, que es información administrativa nuestra (con qué línea del
//     estado de cuenta se concilia este ingreso);
//   • el MEDIO DE PAGO, que es un dato fiscal: la 4.4 obliga a declararlo en
//     `MedioPago/TipoMedioPago` y desde setiembre de 2025 distingue el SINPE
//     Móvil del resto de las transferencias.
//
// Elegir la cuenta determina el medio de pago, en vez de pedir los dos y
// permitir la combinación imposible («efectivo» depositado por SINPE).
//
// IMPORTANTE: acá solo van cuentas DEL EMISOR, es decir de la sociedad que
// factura. Un pago recibido en una cuenta personal no respalda una factura de
// la sociedad; corregir eso después es un movimiento contable, no un cambio de
// catálogo. Para agregar o quitar una cuenta se edita esta lista; el endpoint
// rechaza cualquier código que no esté acá.

/** @typedef {{ codigo: string, etiqueta: string, medioPago: string }} CuentaDeCobro */

export const CUENTAS_DE_COBRO = Object.freeze({
  EFECTIVO: {
    codigo: "EFECTIVO",
    etiqueta: "Efectivo",
    // `efectivo` → 01 en MEDIO_PAGO_MAP.
    medioPago: "efectivo",
  },
  SINPE_MOVIL: {
    codigo: "SINPE_MOVIL",
    etiqueta: "SINPE Móvil",
    // La 4.4 le dio código propio (06). Antes se declaraba como transferencia,
    // que es lo que la versión nueva vino justamente a separar.
    medioPago: "sinpe",
  },
  TRANSFERENCIA_BAC: {
    codigo: "TRANSFERENCIA_BAC",
    etiqueta: "Transferencia o depósito — BAC",
    medioPago: "transferencia",
  },
  TRANSFERENCIA_BN: {
    codigo: "TRANSFERENCIA_BN",
    etiqueta: "Transferencia o depósito — Banco Nacional",
    medioPago: "transferencia",
  },
  TARJETA_DATAFONO: {
    codigo: "TARJETA_DATAFONO",
    etiqueta: "Tarjeta — datáfono",
    medioPago: "tarjeta",
  },
});

export const CODIGOS_DE_CUENTA = Object.freeze(Object.keys(CUENTAS_DE_COBRO));

/**
 * La cuenta con ese código, o null si no está en el catálogo.
 *
 * Devuelve null en vez de lanzar porque quien llama tiene que poder contestarle
 * al administrador con un mensaje y no con un 500.
 *
 * @param {string} codigo
 * @returns {CuentaDeCobro|null}
 */
export function cuentaDeCobro(codigo) {
  const clave = String(codigo || "").trim().toUpperCase();
  return CUENTAS_DE_COBRO[clave] || null;
}

/** Para armar un selector en el panel sin exponer la forma interna del catálogo. */
export function opcionesDeCuenta() {
  return CODIGOS_DE_CUENTA.map((codigo) => ({
    codigo,
    etiqueta: CUENTAS_DE_COBRO[codigo].etiqueta,
  }));
}
