import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), reconcile: vi.fn(), rate: vi.fn(), alert: vi.fn(), after: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session }));
vi.mock("@/lib/onvo/process-payment", () => ({ reconcileOnvoPayment: mocks.reconcile }));
vi.mock("@/lib/exchange-rate", () => ({ obtenerTipoCambio: mocks.rate }));
vi.mock("@/lib/onvo/payment-alert", () => ({ sendAdminPaymentAlert: mocks.alert }));
vi.mock("next/server", async (original) => ({ ...await original(), after: mocks.after }));
vi.mock("@/lib/analytics/reportDepositConversion", () => ({ reportDepositConversion: vi.fn() }));
vi.mock("@/lib/analytics/meta-events", () => ({ sendPurchaseMeta: vi.fn() }));
vi.mock("@/lib/payment-deliveries", () => ({ processPaymentDeliveries: vi.fn() }));
import { POST } from "@/app/api/admin/reconciliation/route";

const request = (body = { unmatchedId: "unmatched-local", transactionId: "tx-local" }) => new Request("https://example.invalid/api/admin/reconciliation", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ role: "ADMIN" });
  mocks.rate.mockResolvedValue({ rate: 510 });
  mocks.alert.mockResolvedValue(null);
});
afterEach(() => vi.restoreAllMocks());

describe("conciliación administrativa", () => {
  it.each([null, "USER", "PROFESSIONAL"])("rechaza el rol %s antes de acceder a pagos", async (role) => {
    mocks.session.mockResolvedValue(role ? { role } : null);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
  });
  it("requiere ambas referencias", async () => {
    expect((await POST(request({ unmatchedId: "local" }))).status).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it.each([["not_found", 404], ["conflict", 409], ["duplicate", 200]])("responde a %s sin repetir notificaciones", async (kind, status) => {
    mocks.reconcile.mockResolvedValue({ kind });
    expect((await POST(request())).status).toBe(status);
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("conserva la alerta fiscal después de la conciliación", async () => {
    mocks.reconcile.mockResolvedValue({ kind: "processed", fiscalWarning: true, transaction: {
      id: "tx-local", type: "FULL_100", onvoEventId: "evt-local", amount: 40000, currency: "CRC",
    } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.alert).toHaveBeenCalledWith(expect.objectContaining({ paymentRecorded: true, eventId: "evt-local" }));
  });
  it("un fallo de persistencia devuelve 500 sin exponer detalles ni notificar", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.reconcile.mockRejectedValue(Object.assign(new Error("PRIVATE_TEST_ONLY"), { code: "P2034" }));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json()) + JSON.stringify(log.mock.calls)).not.toContain("PRIVATE_TEST_ONLY");
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
