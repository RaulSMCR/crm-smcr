// tests/unit/pagos-manuales.test.js
// Pago que el administrador reporta a mano y la factura que sale de ahí.
// Prisma está mockeado; la construcción de la factura corre de verdad, porque es
// justo lo que hay que ver: consecutivo, CABYS, desglose del impuesto y medio de
// pago declarado.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, tx, enqueueDelivery, ocuparCupo, revalidar } = vi.hoisted(() => {
  const tx = {
    appointment: { findUnique: vi.fn(), update: vi.fn() },
    paymentTransaction: { findFirst: vi.fn(), create: vi.fn() },
    invoiceSequence: { upsert: vi.fn() },
    invoice: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    professionalProfile: { findUnique: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn(async (fn) => fn(tx)) },
    enqueueDelivery: vi.fn(),
    ocuparCupo: vi.fn(async () => ({ ocupado: false, cambiaPrecio: false })),
    revalidar: vi.fn(),
  };
});

vi.mock("@/lib/delivery-jobs", () => ({ enqueueDelivery }));
vi.mock("@/lib/price-ladder-server", () => ({ ocuparCupoEnTransaccion: ocuparCupo }));
vi.mock("@/lib/revalidar-precios", () => ({ revalidarPreciosPublicos: revalidar }));

import { registrarPagoManual, SLUG_PROFESIONAL_GESTIONADO } from "@/lib/pagos-manuales";
import { HUB_PROFILE_SLUG } from "@/lib/hub-raul";

const CLIENTE = {
  id: "cli1",
  name: "Ana Solano",
  email: "ana@example.com",
  identification: "118640234",
  billingName: null,
  billingIdType: null,
  billingIdNumber: null,
  billingEmail: null,
};

const SERVICIO = {
  id: "svc1",
  title: "Consulta psicológica",
  cabysCode: "9319000000000",
  taxId: "tax4",
  tax: { id: "tax4", rate: 4 },
};

const CITA = {
  id: "cita1",
  status: "CONFIRMED",
  paymentStatus: "UNPAID",
  date: new Date("2026-09-28T16:00:00.000Z"),
  pricePaid: 30000,
  priceTierId: null,
  patientId: "cli1",
  professionalId: "pro1",
  serviceId: "svc1",
  service: SERVICIO,
  patient: CLIENTE,
  professional: { id: "pro1", slug: "raul-olmedo", academicDegree: "LICENCIATURA", user: { name: "Raúl Olmedo", email: "raul@example.com" } },
};

const BASE = { monto: 30000, cuenta: "SINPE_MOVIL", referencia: "comprobante 9912" };

beforeEach(() => {
  vi.clearAllMocks();
  tx.appointment.findUnique.mockResolvedValue({ ...CITA });
  tx.paymentTransaction.findFirst.mockResolvedValue(null);
  tx.paymentTransaction.create.mockImplementation(async ({ data }) => ({ id: "txn1", ...data }));
  tx.invoiceSequence.upsert.mockResolvedValue({ prefix: "", currentNumber: 7, padding: 4 });
  tx.invoice.create.mockResolvedValue({ id: "inv1", invoiceNumber: "0007" });
  tx.user.findUnique.mockResolvedValue({ ...CLIENTE });
  tx.service.findUnique.mockResolvedValue({ ...SERVICIO });
  tx.professionalProfile.findUnique.mockResolvedValue({ id: "pro1" });
  ocuparCupo.mockResolvedValue({ ocupado: false, cambiaPrecio: false });
});

/** Datos con que se llamó a invoice.create, sin repetir el acceso en cada prueba. */
function facturaCreada() {
  return tx.invoice.create.mock.calls[0][0].data;
}

describe("registrarPagoManual() — lo que no se acepta", () => {
  it("rechaza una cuenta que no está en el catálogo", async () => {
    const res = await registrarPagoManual(prisma, { ...BASE, cuenta: "CUENTA_PERSONAL", appointmentId: "cita1" });
    expect(res).toMatchObject({ ok: false, status: 400, code: "CUENTA_INVALIDA" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza un monto que no es un número positivo", async () => {
    for (const monto of [0, -1, "abc", null]) {
      const res = await registrarPagoManual(prisma, { ...BASE, monto, appointmentId: "cita1" });
      expect(res.code).toBe("MONTO_INVALIDO");
    }
  });

  it("rechaza un pago fechado en el futuro", async () => {
    const manana = new Date(Date.now() + 24 * 60 * 60_000);
    const res = await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1", fechaPago: manana });
    expect(res).toMatchObject({ ok: false, code: "FECHA_FUTURA" });
    expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("no acredita a mano el cobro de otro profesional", async () => {
    tx.appointment.findUnique.mockResolvedValue({ ...CITA, professional: { ...CITA.professional, slug: "otra-persona" } });
    const res = await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1" });
    expect(res).toMatchObject({ ok: false, status: 409, code: "PROFESIONAL_NO_PERMITIDO" });
    expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("no cobra dos veces una cita ya pagada", async () => {
    tx.appointment.findUnique.mockResolvedValue({ ...CITA, paymentStatus: "PAID" });
    const res = await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1" });
    expect(res.code).toBe("CITA_YA_PAGADA");
  });

  it("no registra dos veces el mismo tramo de cobro", async () => {
    tx.paymentTransaction.findFirst.mockResolvedValue({ id: "txn-previo" });
    const res = await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1" });
    expect(res.code).toBe("COBRO_DUPLICADO");
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("no inventa el CABYS de un servicio que no lo tiene", async () => {
    tx.appointment.findUnique.mockResolvedValue({ ...CITA, service: { ...SERVICIO, cabysCode: null } });
    const res = await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1" });
    expect(res).toMatchObject({ ok: false, code: "SERVICIO_SIN_CABYS" });
  });

  // El consecutivo se quema igual cuando Hacienda rechaza: el receptor se
  // comprueba antes de reclamar el número, no al armar el XML.
  it("no quema un consecutivo con un receptor sin identificación", async () => {
    tx.appointment.findUnique.mockResolvedValue({ ...CITA, patient: { ...CLIENTE, identification: null } });
    const res = await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1" });
    expect(res).toMatchObject({ ok: false, code: "RECEPTOR_SIN_IDENTIFICACION" });
    expect(tx.invoiceSequence.upsert).not.toHaveBeenCalled();
  });

  it("exige describir un cobro que no viene de una cita", async () => {
    const res = await registrarPagoManual(prisma, { ...BASE, contactId: "cli1", serviceId: "svc1", descripcion: "x" });
    expect(res.code).toBe("DESCRIPCION_REQUERIDA");
  });
});

describe("registrarPagoManual() — cobro de una cita", () => {
  it("acredita el pago sin comisión de procesador y deja la cita pagada", async () => {
    const fechaPago = new Date("2026-09-30T18:00:00.000Z");
    const res = await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1", fechaPago, registradoPor: "admin1" });

    expect(res).toMatchObject({ ok: true, modo: "cita", invoiceId: "inv1", transactionId: "txn1", paymentStatus: "PAID" });
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        appointmentId: "cita1",
        patientId: "cli1",
        professionalId: "pro1",
        type: "FULL_100",
        amount: 30000,
        status: "APPROVED",
        paidAt: fechaPago,
        taxRate: 4,
        // Cero y no NULL: sin procesador no hay comisión, y un NULL haría que la
        // liquidación le estimara una al profesional.
        processingFee: 0,
      }),
    });
    expect(tx.appointment.update).toHaveBeenCalledWith({ where: { id: "cita1" }, data: { paymentStatus: "PAID" } });
  });

  it("un adelanto deja la cita parcialmente pagada", async () => {
    const res = await registrarPagoManual(prisma, { ...BASE, monto: 15000, appointmentId: "cita1", tipo: "DEPOSIT_50" });
    expect(res.paymentStatus).toBe("PARTIALLY_PAID");
    expect(tx.appointment.update).toHaveBeenCalledWith({ where: { id: "cita1" }, data: { paymentStatus: "PARTIALLY_PAID" } });
  });

  it("emite la factura con la cuenta anotada, el medio de pago de la 4.4 y el IVA incluido", async () => {
    await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1" });

    const factura = facturaCreada();
    expect(factura).toMatchObject({
      invoiceNumber: "0007",
      status: "PAID",
      cuentaDeposito: "SINPE_MOVIL",
      paymentMethod: "sinpe",
      contactIdType: "01",
      contactIdNumber: "118640234",
      total: 30000,
      amountPaid: 30000,
      balance: 0,
      originDocument: "PAGO_MANUAL:txn1",
    });
    // 30 000 con el 4% adentro: no es un cargo adicional.
    expect(factura.subtotal).toBeCloseTo(28846.15, 2);
    expect(factura.taxAmount).toBeCloseTo(1153.85, 2);
    expect(factura.notes).toContain("SINPE Móvil");
    expect(factura.notes).toContain("comprobante 9912");
    expect(factura.lines.create.cabysCode).toBe("9319000000000");
  });

  it("encola el aviso del pago y el envío a Hacienda, y ocupa el cupo de la escalera", async () => {
    await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1" });

    const clases = enqueueDelivery.mock.calls.map(([, job]) => job.kind);
    expect(clases).toEqual(["PAYMENT_CONFIRMATION", "FE_SUBMISSION"]);
    expect(enqueueDelivery).toHaveBeenCalledWith(tx, { kind: "PAYMENT_CONFIRMATION", invoiceId: "inv1", paymentTransactionId: "txn1" });
    expect(ocuparCupo).toHaveBeenCalledWith(tx, expect.objectContaining({ id: "cita1", patientId: "cli1" }));
  });

  it("revalida los precios públicos cuando el pago llenó un escalón", async () => {
    ocuparCupo.mockResolvedValue({ ocupado: true, cambiaPrecio: true });
    const res = await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1" });
    expect(res.ok).toBe(true);
    expect(revalidar).toHaveBeenCalled();
  });

  it("un fallo al revalidar no convierte en error una factura ya emitida", async () => {
    ocuparCupo.mockResolvedValue({ ocupado: true, cambiaPrecio: true });
    revalidar.mockImplementation(() => { throw new Error("revalidate falló"); });
    const res = await registrarPagoManual(prisma, { ...BASE, appointmentId: "cita1" });
    expect(res).toMatchObject({ ok: true, invoiceId: "inv1" });
  });
});

describe("registrarPagoManual() — ingreso sin cita", () => {
  const SUELTO = { ...BASE, contactId: "cli1", serviceId: "svc1", descripcion: "Taller de manejo del estrés, setiembre 2026" };

  it("factura al cliente sin registrar pago ni mover liquidaciones", async () => {
    const fechaPago = new Date("2026-09-29T15:00:00.000Z");
    const res = await registrarPagoManual(prisma, { ...SUELTO, fechaPago, registradoPor: "admin1" });

    expect(res).toMatchObject({ ok: true, modo: "suelto", invoiceId: "inv1", invoiceNumber: "0007" });
    // Sin cita no hay PaymentTransaction posible, así que este ingreso no entra
    // en ninguna liquidación ni ocupa cupo de escalera.
    expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
    expect(ocuparCupo).not.toHaveBeenCalled();

    const factura = facturaCreada();
    expect(factura).toMatchObject({
      contactId: "cli1",
      professionalId: "pro1",
      status: "PAID",
      cuentaDeposito: "SINPE_MOVIL",
      paymentMethod: "sinpe",
      paymentDate: fechaPago,
      originDocument: "PAGO_MANUAL_SIN_CITA",
      createdBy: "admin1",
    });
    expect(factura.appointmentId).toBeUndefined();
    expect(factura.lines.create).toMatchObject({
      serviceId: "svc1",
      cabysCode: "9319000000000",
      taxId: "tax4",
      taxRate: 4,
      description: "Taller de manejo del estrés, setiembre 2026",
    });
  });

  it("la fecha de emisión es la de hoy aunque el pago se haya recibido antes", async () => {
    const antes = new Date("2026-09-20T15:00:00.000Z");
    await registrarPagoManual(prisma, { ...SUELTO, fechaPago: antes });
    const factura = facturaCreada();
    expect(factura.paymentDate).toEqual(antes);
    // Hacienda rechaza un comprobante fechado fuera de su ventana: lo que se
    // retrotrae es el pago, no la emisión.
    expect(factura.invoiceDate.getTime()).toBeGreaterThan(antes.getTime());
  });

  it("encola el envío a Hacienda, que es lo que termina con el correo al cliente", async () => {
    await registrarPagoManual(prisma, SUELTO);
    expect(enqueueDelivery).toHaveBeenCalledTimes(1);
    expect(enqueueDelivery).toHaveBeenCalledWith(tx, { kind: "FE_SUBMISSION", invoiceId: "inv1" });
  });

  it("rechaza un cliente que no existe", async () => {
    tx.user.findUnique.mockResolvedValue(null);
    const res = await registrarPagoManual(prisma, SUELTO);
    expect(res).toMatchObject({ ok: false, status: 404, code: "CLIENTE_INEXISTENTE" });
  });

  it("factura a nombre de la empresa cuando el cliente cargó datos de facturación", async () => {
    tx.user.findUnique.mockResolvedValue({
      ...CLIENTE,
      billingName: "Consultora Ejemplo S.A.",
      billingIdType: "02",
      billingIdNumber: "3101885661",
    });
    await registrarPagoManual(prisma, SUELTO);
    expect(facturaCreada()).toMatchObject({
      contactName: "Consultora Ejemplo S.A.",
      contactIdType: "02",
      contactIdNumber: "3101885661",
    });
  });
});

describe("el profesional gestionado", () => {
  // Es el mismo valor que el hub, repetido para no arrastrar su JSON al bundle
  // de la función de facturación. Si uno cambia sin el otro, el endpoint empieza
  // a rechazar todos los cobros.
  it("es el mismo que el del hub", () => {
    expect(SLUG_PROFESIONAL_GESTIONADO).toBe(HUB_PROFILE_SLUG);
  });
});
