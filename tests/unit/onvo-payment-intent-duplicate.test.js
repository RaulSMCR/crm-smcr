import { beforeEach, describe, expect, it, vi } from "vitest";

// ONVO avisa cada cobro dos veces: checkout-session.succeeded (con enlace) y
// payment-intent.succeeded (sin enlace). El segundo no debe abrir una
// conciliación pendiente ni disparar la alerta al admin.
vi.mock("@/lib/onvo/payment-invoice", () => ({ createPaymentInvoice: vi.fn(async () => ({ invoiceId: "inv-1" })) }));
vi.mock("@/lib/delivery-jobs", () => ({ enqueueDelivery: vi.fn() }));
vi.mock("@/lib/price-ladder-server", () => ({ ocuparCupoEnTransaccion: vi.fn(async () => ({ cambiaPrecio: false })) }));
vi.mock("@/lib/revalidar-precios", () => ({ revalidarPreciosPublicos: vi.fn() }));
vi.mock("@/lib/commission-plan", () => ({ estimateOnvoFee: () => ({ totalCents: 0, fixedUsd: 0, usdCrcRate: 510 }) }));

import { normalizeOnvoEvent } from "@/lib/onvo/event";
import { processOnvoPayment } from "@/lib/onvo/process-payment";

const INTENT = "pi_local";

function fakePrisma({ acreditada = null, candidatas = [] } = {}) {
  const tx = {
    paymentTransaction: {
      findFirst: vi.fn(async ({ where }) => (where.webhookPayload ? acreditada : null)),
      findMany: vi.fn(async () => candidatas),
      update: vi.fn(async ({ data }) => ({ ...candidatas[0], ...data })),
    },
    unmatchedPayment: { findUnique: vi.fn(async () => null), create: vi.fn(), updateMany: vi.fn() },
    appointment: { update: vi.fn() },
  };
  return { tx, prisma: { $transaction: (fn) => fn(tx) } };
}

const intentBody = { type: "payment-intent.succeeded", data: { id: INTENT, amount: 1500000, currency: "CRC" } };
const process = (prisma, body) => processOnvoPayment(prisma, normalizeOnvoEvent(body), body, { usdCrcRate: 510 });

beforeEach(() => vi.stubEnv("ONVO_AMOUNT_DIVISOR", "100"));

describe("payment-intent.succeeded sin enlace", () => {
  it("es duplicado si el checkout ya acreditó ese mismo intent", async () => {
    const { tx, prisma } = fakePrisma({ acreditada: { id: "tx-1" } });
    expect(await process(prisma, intentBody)).toEqual({ kind: "duplicate" });
    expect(tx.paymentTransaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "APPROVED", webhookPayload: { path: ["data", "paymentIntentId"], equals: INTENT } },
    }));
    expect(tx.unmatchedPayment.create).not.toHaveBeenCalled();
  });

  it("sigue quedando para conciliar si ningún pago lo acreditó", async () => {
    const { tx, prisma } = fakePrisma();
    expect(await process(prisma, intentBody)).toMatchObject({ kind: "unmatched", reasonCode: "NO_TRANSACTION" });
    expect(tx.unmatchedPayment.create).toHaveBeenCalled();
  });
});

describe("checkout-session.succeeded después del aviso sin enlace", () => {
  it("cierra el pendiente del mismo intent apuntando a la transacción acreditada", async () => {
    const candidata = {
      id: "tx-1", amount: 15000, currency: "CRC", type: "DEPOSIT_50", appointmentId: "apt-1",
      patient: { email: "p@example.invalid" }, appointment: { paymentStatus: "UNPAID", service: { tax: { rate: 4 } } },
    };
    const { tx, prisma } = fakePrisma({ candidatas: [candidata] });
    const body = { type: "checkout-session.succeeded", data: {
      id: "cs_local", paymentLinkId: "link", paymentIntentId: INTENT, paymentStatus: "paid",
      amountTotal: 1500000, currency: "CRC", customerEmail: "p@example.invalid",
    } };
    expect((await process(prisma, body)).kind).toBe("processed");
    expect(tx.unmatchedPayment.updateMany).toHaveBeenCalledWith({
      where: { onvoEventId: `payment-intent.succeeded:${INTENT}`, resolvedAt: null },
      data: { resolvedAt: expect.any(Date), resolvedTxId: "tx-1" },
    });
  });
});
