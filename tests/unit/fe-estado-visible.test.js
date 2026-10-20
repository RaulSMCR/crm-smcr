import { describe, expect, it } from "vitest";
import { accionesFe, estadoFeVisible } from "@/lib/fe/estado-visible";

// La fila tal como la carga ahora /panel/admin/contabilidad. La 0203 real:
// pagada, rechazada por Hacienda por certificado revocado.
const rechazada = {
  invoiceType: "CUSTOMER_INVOICE",
  status: "PAID",
  feStatus: "REJECTED",
  feClave: "50619102600310188566100100001010000000203124547935",
  feErrorMessage: "La firma del comprobante electrónico no es válida (El certificado empleado se encuentra revocado.)",
};

describe("estadoFeVisible", () => {
  it("muestra el rechazo que guarda la base, no SIN_ENVIAR", () => {
    // El defecto: la página no pedía feStatus y la tabla pintaba SIN_ENVIAR en
    // cualquier factura después de recargar.
    expect(estadoFeVisible(rechazada)).toBe("REJECTED");
  });

  it("sin clave es SIN_ENVIAR aunque la base diga PENDING", () => {
    // PENDING es el valor por defecto de la columna: también lo tiene una factura
    // que jamás se envió. Mostrarlo daría a entender que Hacienda la procesa.
    expect(estadoFeVisible({ feStatus: "PENDING", feClave: null })).toBe("SIN_ENVIAR");
  });

  it("con clave y sin veredicto, PENDING", () => {
    expect(estadoFeVisible({ feStatus: "PENDING", feClave: "x" })).toBe("PENDING");
    expect(estadoFeVisible({ feStatus: null, feClave: "x" })).toBe("PENDING");
  });

  it("una fila vacía no rompe el render", () => {
    expect(estadoFeVisible()).toBe("SIN_ENVIAR");
    expect(accionesFe()).toEqual({ enviar: false, consultar: false, notaCredito: false, reemitir: false });
  });
});

describe("accionesFe — las dos trampas de una rechazada", () => {
  it("una rechazada ofrece reemitir, y nada más", () => {
    expect(accionesFe(rechazada)).toEqual({
      // La clave es definitiva: reenviar devuelve el mismo rechazo.
      enviar: false,
      // El veredicto es final: no hay nada que reconsultar.
      consultar: false,
      // Nunca fue aceptada: no hay validez que rectificar.
      notaCredito: false,
      reemitir: true,
    });
  });

  it("también una rechazada OPEN se reemite", () => {
    expect(accionesFe({ ...rechazada, status: "OPEN" }).reemitir).toBe(true);
  });

  it("una rechazada ya anulada no vuelve a ofrecer reemitir", () => {
    expect(accionesFe({ ...rechazada, status: "CANCELLED" }).reemitir).toBe(false);
  });

  it("la nota de crédito solo aparece sobre una factura aceptada", () => {
    expect(accionesFe({ ...rechazada, feStatus: "ACCEPTED" })).toMatchObject({ notaCredito: true, reemitir: false, enviar: false });
  });

  it("una factura pagada que nunca se envió no lleva nota de crédito", () => {
    const sinEnviar = { invoiceType: "CUSTOMER_INVOICE", status: "PAID", feStatus: "PENDING", feClave: null };
    expect(accionesFe(sinEnviar)).toEqual({ enviar: true, consultar: false, notaCredito: false, reemitir: false });
  });

  it("una enviada sin veredicto se puede consultar y reenviar", () => {
    const pendiente = { invoiceType: "CUSTOMER_INVOICE", status: "PAID", feStatus: "PENDING", feClave: "x" };
    expect(accionesFe(pendiente)).toMatchObject({ enviar: true, consultar: true, notaCredito: false, reemitir: false });
  });

  it("las facturas de proveedor conservan su nota de crédito", () => {
    // No pasan por nuestro envío a Hacienda: su feStatus nunca llega a ACCEPTED.
    const proveedor = { invoiceType: "SUPPLIER_INVOICE", status: "PAID", feStatus: "PENDING", feClave: null };
    expect(accionesFe(proveedor).notaCredito).toBe(true);
    expect(accionesFe(proveedor).reemitir).toBe(false);
  });
});
