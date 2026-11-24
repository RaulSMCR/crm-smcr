import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { invoice: { findUnique: m.find, update: m.update } } }));
vi.mock("@/lib/api-guards", () => ({ requireAdmin: async () => ({ session: { userId: "admin" } }) }));

const { POST } = await import("@/app/api/invoices/[id]/cancel/route");
const cancelar = (id = "f1") => POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id }) });

// 23-nov-2026: la 0222, aceptada por Hacienda y ya enviada al paciente, se
// canceló desde el listado. Ante Hacienda seguía vigente; el CRM dejó de
// contar el ingreso. Lo aceptado se corrige con nota de crédito.
describe("cancelar un comprobante", () => {
  beforeEach(() => { vi.resetAllMocks(); m.update.mockResolvedValue({ id: "f1", status: "CANCELLED" }); });

  it("no cancela una factura que Hacienda aceptó", async () => {
    m.find.mockResolvedValue({ id: "f1", status: "OPEN", amountPaid: 0, feStatus: "ACCEPTED", invoiceType: "CUSTOMER_INVOICE" });
    const res = await cancelar();
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/nota de crédito/);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("no cancela una nota de crédito aceptada", async () => {
    m.find.mockResolvedValue({ id: "f1", status: "OPEN", amountPaid: 0, feStatus: "ACCEPTED", invoiceType: "CUSTOMER_CREDIT_NOTE" });
    expect((await cancelar()).status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("sí cancela una que Hacienda rechazó", async () => {
    m.find.mockResolvedValue({ id: "f1", status: "OPEN", amountPaid: 0, feStatus: "REJECTED", invoiceType: "CUSTOMER_CREDIT_NOTE" });
    expect((await cancelar()).status).toBe(200);
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELLED" } }));
  });
});
