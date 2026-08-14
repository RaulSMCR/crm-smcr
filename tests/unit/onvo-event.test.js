// tests/unit/onvo-event.test.js
//
// El mapeo del webhook, validado contra un evento REAL de ONVO capturado el
// 2026-08-14 tras un pago de prueba efectivo. El payload va textual a propósito:
// la versión anterior del mapeo se escribió contra un contrato supuesto y no
// acertaba un solo campo, así que acá manda lo que ONVO manda de verdad.
import { describe, it, expect } from "vitest";
import { normalizeOnvoEvent } from "../../src/lib/onvo/event.js";

// Evento real, recortado solo en los campos irrelevantes (descuentos vacíos).
const EVENTO_REAL = {
  type: "checkout-session.succeeded",
  data: {
    id: "test_8xvQyMq0p0aRwp1XU_XJ_sSuknE",
    url: "https://checkout.onvopay.com/pay/test_8xvQyMq0p0aRwp1XU_XJ_sSuknE",
    mode: "test",
    status: "open", // ojo: sigue en "open" aunque el pago ya se cobró
    amountSubTotal: 4800000,
    amountTotal: 4800000,
    originalAmountTotal: 4800000,
    currency: "CRC",
    paymentMode: "payment",
    paymentStatus: "paid", // este es el campo que vale
    customerEmail: "raul.olmedo@gmail.com",
    customerPhone: "+541133470170",
    customerName: "Raúl Olmedo",
    paymentMethodTypes: [],
    updatedAt: "2026-08-14T19:10:44.572Z",
    createdAt: "2026-08-14T19:02:36.488Z",
    customerId: "cmstbiao31x4zk54nmsupw5gu",
    paymentLinkId: "test_L0DESCGOXMB7AkSef2C5jZzHs6s",
    paymentIntentId: "cmstbduil23buk83w19gqnos8",
    metadata: null,
    lineItems: [
      { name: "E2E sandbox - consulta de prueba", currency: "CRC", amount: 4800000, priceId: "cmst8gdoe1u7sk83wzbrlyy8u" },
    ],
    customer: {
      id: "cmstbiao31x4zk54nmsupw5gu",
      name: "Raúl Olmedo",
      phone: "+541133470170",
      email: "raul.olmedo@gmail.com",
    },
  },
};

describe("normalizeOnvoEvent() con el evento real", () => {
  const evento = normalizeOnvoEvent(EVENTO_REAL);

  it("extrae el enlace de pago, que es la llave para conciliar", () => {
    expect(evento.onvoLinkId).toBe("test_L0DESCGOXMB7AkSef2C5jZzHs6s");
  });

  it("reconoce el cobro por paymentStatus y NO por status", () => {
    // `status` vale "open" en este mismo evento: leerlo dejaría el pago sin
    // acreditar aunque el dinero haya entrado.
    expect(EVENTO_REAL.data.status).toBe("open");
    expect(evento.resultado).toBe("aprobado");
  });

  it("arma un identificador de evento pese a que ONVO no manda uno", () => {
    expect(EVENTO_REAL.id).toBeUndefined();
    expect(evento.eventId).toBe("checkout-session.succeeded:test_8xvQyMq0p0aRwp1XU_XJ_sSuknE");
  });

  it("toma el monto en la unidad menor: 4800000 son ₡48.000", () => {
    expect(evento.amount).toBe(4800000);
    expect(evento.amount / 100).toBe(48000);
  });

  it("toma moneda, correo del pagador y momento del cobro", () => {
    expect(evento.currency).toBe("CRC");
    expect(evento.customerEmail).toBe("raul.olmedo@gmail.com");
    expect(evento.paidAt.toISOString()).toBe("2026-08-14T19:10:44.572Z");
  });

  it("cae a tarjeta cuando ONVO no informa el medio de pago", () => {
    expect(EVENTO_REAL.data.paymentMethodTypes).toEqual([]);
    expect(evento.paymentMethod).toBe("card");
  });

  it("conserva el paymentIntentId para rastrear el cobro en ONVO", () => {
    expect(evento.paymentIntentId).toBe("cmstbduil23buk83w19gqnos8");
  });
});

describe("normalizeOnvoEvent() en otros escenarios", () => {
  it("marca como rechazado un pago fallido", () => {
    const evento = normalizeOnvoEvent({
      type: "payment-intent.failed",
      data: { id: "pi_1", paymentStatus: "unpaid", amount: 4800000, currency: "CRC" },
    });
    expect(evento.resultado).toBe("rechazado");
  });

  it("usa el tipo de evento cuando no viene paymentStatus", () => {
    expect(normalizeOnvoEvent({ type: "payment-intent.succeeded", data: { id: "pi_2" } }).resultado)
      .toBe("aprobado");
    expect(normalizeOnvoEvent({ type: "payment-intent.failed", data: { id: "pi_3" } }).resultado)
      .toBe("rechazado");
  });

  it("no inventa un resultado ante un evento desconocido", () => {
    expect(normalizeOnvoEvent({ type: "subscription.renewal.succeeded", data: { id: "x" } }).resultado)
      .toBe("pendiente");
  });

  it("toma el correo del objeto customer si falta customerEmail", () => {
    const evento = normalizeOnvoEvent({
      type: "checkout-session.succeeded",
      data: { id: "cs_1", customer: { email: "otro@ejemplo.cr" } },
    });
    expect(evento.customerEmail).toBe("otro@ejemplo.cr");
  });

  it("prefiere el medio de pago informado sobre el default", () => {
    const evento = normalizeOnvoEvent({
      type: "checkout-session.succeeded",
      data: { id: "cs_2", paymentMethodTypes: ["sinpe_movil"] },
    });
    expect(evento.paymentMethod).toBe("sinpe_movil");
  });

  it("sin identificador de objeto no hay evento que procesar", () => {
    expect(normalizeOnvoEvent({ type: "checkout-session.succeeded", data: {} }).eventId).toBeNull();
    expect(normalizeOnvoEvent({}).eventId).toBeNull();
  });
});
