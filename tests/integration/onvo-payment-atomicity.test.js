import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { normalizeOnvoEvent } from "@/lib/onvo/event";
import { processOnvoPayment, reconcileOnvoPayment } from "@/lib/onvo/process-payment";

// Opt-in, exclusivamente una base desechable local con esquema ya restaurado.
// No cargar .env, ejecutar migraciones ni usar DATABASE_URL como alternativa.
const databaseUrl = process.env.SMCR_LOCAL_DB_TEST_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "55439" ||
      !/^\/smcr_payment_test_[a-z0-9_]+$/.test(url.pathname)) {
    throw new Error("Se requiere una base de pruebas desechable en 127.0.0.1:55439");
  }
}

describe.skipIf(!databaseUrl)("ONVO: atomicidad y concurrencia con PostgreSQL local", () => {
  let db;
  const appointments = [], users = [], professionals = [], services = [], events = [];

  beforeAll(() => {
    db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
    vi.stubEnv("ONVO_AMOUNT_DIVISOR", "100");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Proveedores externos prohibidos"); }));
  });
  afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); });
  afterAll(async () => {
    try {
      expect(globalThis.fetch).not.toHaveBeenCalled();
      // Borrar solo las filas ficticias creadas por esta suite.
      await db.invoice.deleteMany({ where: { appointmentId: { in: appointments } } });
      await db.unmatchedPayment.deleteMany({ where: { onvoEventId: { in: events } } });
      await db.appointment.deleteMany({ where: { id: { in: appointments } } });
      await db.professionalProfile.deleteMany({ where: { id: { in: professionals } } });
      await db.service.deleteMany({ where: { id: { in: services } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    } finally {
      await db.$disconnect();
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });

  async function fixture({ type = "FULL_100", amount = 40000, paymentStatus = "UNPAID", status = "LINK_SENT" } = {}) {
    const id = randomUUID();
    const patient = await db.user.create({ data: { name: "Paciente ficticio", email: `${id}@example.invalid`, phone: "00000000", passwordHash: "not-a-password" } });
    users.push(patient.id);
    const proUser = await db.user.create({ data: { name: "Profesional ficticio", email: `pro-${id}@example.invalid`, phone: "00000000", passwordHash: "not-a-password", role: "PROFESSIONAL" } });
    users.push(proUser.id);
    const pro = await db.professionalProfile.create({ data: { userId: proUser.id, slug: id, specialty: "Psicología" } });
    professionals.push(pro.id);
    const service = await db.service.create({ data: { title: "Servicio ficticio", slug: id, price: 40000, durationMin: 60 } });
    services.push(service.id);
    const appointment = await db.appointment.create({ data: {
      patientId: patient.id, professionalId: pro.id, serviceId: service.id,
      date: new Date("2026-10-01T16:00:00Z"), endDate: new Date("2026-10-01T17:00:00Z"),
      pricePaid: 40000, paymentStatus,
    } });
    appointments.push(appointment.id);
    const tx = await db.paymentTransaction.create({ data: {
      appointmentId: appointment.id, professionalId: pro.id, patientId: patient.id,
      type, amount, status, onvoPaymentLinkId: `local-${id}`,
    } });
    return { tx, patient, appointment };
  }
  function payload(f, overrides = {}, type = "checkout-session.succeeded") {
    const body = { type, data: {
      id: randomUUID(), paymentLinkId: f.tx.onvoPaymentLinkId, paymentStatus: "paid",
      amountTotal: Number(f.tx.amount) * 100, currency: "CRC", customerEmail: f.patient.email,
      updatedAt: "2026-09-11T12:00:00Z", ...overrides,
    } };
    events.push(normalizeOnvoEvent(body).eventId);
    return body;
  }
  const process = (body, client = db) => processOnvoPayment(client, normalizeOnvoEvent(body), body, { usdCrcRate: 510 });
  const reconcile = (f, unmatched, client = db) => reconcileOnvoPayment(client, { unmatchedId: unmatched.id, transactionId: f.tx.id, usdCrcRate: 510 });
  const sequence = async () => (await db.invoiceSequence.findUnique({ where: { sequenceType: "CUSTOMER_INVOICE" } }))?.currentNumber ?? 0;
  const invoices = (f) => db.invoice.findMany({ where: { appointmentId: f.appointment.id }, include: { lines: true } });
  async function unmatched(body) {
    const event = normalizeOnvoEvent(body);
    return db.unmatchedPayment.create({ data: {
      onvoEventId: event.eventId, onvoLinkId: event.onvoLinkId,
      amount: event.amount, currency: event.currency, reason: "Revisión de prueba", payload: body,
    } });
  }
  // Inyectar un fallo SQL auténtico dentro de la transacción interactiva.
  function brokenClient(model, method) {
    return { $transaction: (fn, options) => db.$transaction((tx) => fn(new Proxy(tx, {
      get(target, key) {
        if (key !== model) return target[key];
        return { ...target[key], [method]: (args) => target[key][method](method === "create"
          ? { ...args, data: { ...args.data, contactId: randomUUID() } }
          : { ...args, where: { id: randomUUID() } }) };
      },
    })), options) };
  }
  async function expectUnchanged(f, number) {
    const tx = await db.paymentTransaction.findUnique({ where: { id: f.tx.id } });
    expect(tx.status).toBe(f.tx.status);
    expect(tx.onvoEventId).toBeNull();
    expect(tx.paidAt).toBeNull();
    expect((await db.appointment.findUnique({ where: { id: f.appointment.id } })).paymentStatus).toBe(f.appointment.paymentStatus);
    expect(await invoices(f)).toHaveLength(0);
    expect(await sequence()).toBe(number);
  }

  it("seis copias simultáneas acreditan una sola vez y generan una factura", async () => {
    const f = await fixture(), body = payload(f), number = await sequence();
    const results = await Promise.all(Array.from({ length: 6 }, () => process(body)));
    expect(results.filter((r) => r.kind === "processed")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "duplicate")).toHaveLength(5);
    expect(await sequence()).toBe(number + 1);
    const [invoice] = await invoices(f);
    expect(invoice).toMatchObject({ status: "PAID", originDocument: `ONVO_TX:${f.tx.id}` });
    expect(Number(invoice.total)).toBe(40000);
    expect(Number(invoice.amountPaid)).toBe(40000);
    expect(Number(invoice.balance)).toBe(0);
    expect(invoice.lines).toHaveLength(1);
    expect(Number(invoice.lines[0].lineTotal)).toBe(40000);
    expect((await db.paymentTransaction.findUnique({ where: { id: f.tx.id } })).status).toBe("APPROVED");
    expect((await db.appointment.findUnique({ where: { id: f.appointment.id } })).paymentStatus).toBe("PAID");
  });

  it.each([["invoice", "create", "P2003"], ["appointment", "update", "P2025"]])(
    "un fallo SQL en %s revierte todo y permite reintentar", async (model, method, code) => {
      const f = await fixture(), body = payload(f), number = await sequence();
      await expect(process(body, brokenClient(model, method))).rejects.toMatchObject({ code });
      await expectUnchanged(f, number);
      expect((await process(body)).kind).toBe("processed");
      expect(await invoices(f)).toHaveLength(1);
      expect(await sequence()).toBe(number + 1);
    },
  );

  it.each([false, true])("saldo y adelanto simultáneos o invertidos conservan PAID (%s)", async (concurrent) => {
    const f = await fixture({ type: "DEPOSIT_50", amount: 20000 });
    const balanceTx = await db.paymentTransaction.create({ data: {
      appointmentId: f.appointment.id, professionalId: f.tx.professionalId, patientId: f.patient.id,
      type: "BALANCE_50", amount: 20000, onvoPaymentLinkId: randomUUID(), status: "LINK_SENT",
    } });
    const balance = payload({ ...f, tx: balanceTx }), deposit = payload(f);
    if (concurrent) await Promise.all([process(balance), process(deposit)]);
    else { await process(balance); await process(deposit); }
    expect((await db.appointment.findUnique({ where: { id: f.appointment.id } })).paymentStatus).toBe("PAID");
    expect(await invoices(f)).toHaveLength(2);
  });

  it("una aprobación posterior a un intento fallido se acredita una sola vez", async () => {
    const f = await fixture(), rejected = payload(f, { paymentStatus: "failed" }, "payment-intent.failed");
    expect((await process(rejected)).transaction.status).toBe("REJECTED");
    expect(await invoices(f)).toHaveLength(0);
    const approved = payload(f);
    expect((await process(approved)).transaction.status).toBe("APPROVED");
    expect((await process(approved)).kind).toBe("duplicate");
    await process(rejected);
    expect(await invoices(f)).toHaveLength(1);
    expect((await db.paymentTransaction.findUnique({ where: { id: f.tx.id } })).status).toBe("APPROVED");
  });

  it("registra una sola incidencia ante avisos simultáneos sin coincidencia", async () => {
    const f = await fixture(), body = payload(f, { amountTotal: 100 });
    const results = await Promise.all([process(body), process(body), process(body)]);
    expect(results.filter((r) => r.kind === "unmatched")).toHaveLength(1);
    expect(await db.unmatchedPayment.count({ where: { onvoEventId: normalizeOnvoEvent(body).eventId } })).toBe(1);
    expect(await invoices(f)).toHaveLength(0);
  });

  it("dos conciliaciones del mismo evento y su webhook generan una sola factura", async () => {
    const f = await fixture(), body = payload(f), row = await unmatched(body);
    const results = await Promise.all([reconcile(f, row), reconcile(f, row), process(body)]);
    expect(results.filter((r) => r.kind === "processed")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "duplicate")).toHaveLength(2);
    expect(await invoices(f)).toHaveLength(1);
    expect((await db.unmatchedPayment.findUnique({ where: { id: row.id } })).resolvedTxId).toBe(f.tx.id);
  });

  it("dos incidencias distintas no se aplican a la misma transacción", async () => {
    const f = await fixture(), first = await unmatched(payload(f)), second = await unmatched(payload(f));
    const results = await Promise.all([reconcile(f, first), reconcile(f, second)]);
    expect(results.map((r) => r.kind).sort()).toEqual(["conflict", "processed"]);
    expect(await invoices(f)).toHaveLength(1);
  });

  it("un webhook nuevo y la conciliación manual no acreditan dos veces", async () => {
    const f = await fixture(), row = await unmatched(payload(f)), body = payload(f);
    const results = await Promise.all([reconcile(f, row), process(body)]);
    expect(results.filter((r) => r.kind === "processed")).toHaveLength(1);
    expect(await invoices(f)).toHaveLength(1);
  });

  it("si falla el cierre de la incidencia también revierte pago y factura", async () => {
    const f = await fixture(), row = await unmatched(payload(f)), number = await sequence();
    await expect(reconcile(f, row, brokenClient("unmatchedPayment", "update"))).rejects.toMatchObject({ code: "P2025" });
    await expectUnchanged(f, number);
    expect((await db.unmatchedPayment.findUnique({ where: { id: row.id } })).resolvedAt).toBeNull();
    expect((await reconcile(f, row)).kind).toBe("processed");
  });

  it.each([
    { amountTotal: 100 }, { currency: "USD" }, { customerEmail: "otra-persona@example.invalid" },
    { paymentLinkId: "otro-enlace" }, { paymentStatus: "failed" },
  ])("rechaza conciliación incompatible: %j", async (overrides) => {
    const f = await fixture(), row = await unmatched(payload(f, overrides)), number = await sequence();
    expect((await reconcile(f, row)).kind).toBe("conflict");
    await expectUnchanged(f, number);
  });

  it.each(["APPROVED", "REFUNDED", "EXPIRED"])("no reactiva una transacción %s", async (status) => {
    const f = await fixture({ status }), body = payload(f), row = await unmatched(body), number = await sequence();
    expect((await reconcile(f, row)).kind).toBe("conflict");
    expect((await process(payload(f))).kind).toBe("unmatched");
    await expectUnchanged(f, number);
  });
});
