import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), generate: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), submit: vi.fn(), deliveries: vi.fn(), signed: vi.fn() }));
vi.mock("@/lib/palig-auth", () => ({ requirePaligOperator: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { insuranceClaim: { findUnique: m.findUnique, findFirst: m.findFirst } } }));
vi.mock("@/lib/palig-service", async (original) => ({ ...await original(), generarPagoPalig: m.generate }));
vi.mock("@/lib/fe/submit", () => ({ submitInvoiceToFe: m.submit }));
vi.mock("@/lib/payment-deliveries", () => ({ processPaymentDeliveries: m.deliveries }));
vi.mock("@/lib/storage", async (original) => ({ ...await original(), getSignedUrl: m.signed }));
vi.mock("next/server", async (original) => ({ ...await original(), after: vi.fn() }));
import { POST } from "@/app/api/palig/route";
import { GET, POST as retry } from "@/app/api/palig/claims/[id]/route";
const claim = { id: "c1", invoiceId: "i1", generatedFormUrl: "insurance-signed-forms/c1/palig/form.pdf", invoice: { id: "i1", status: "PAID", total: 30000, feStatus: "PENDING", feXml: "PRIVATE" } };
const ctx = { params: Promise.resolve({ id: "c1" }) };
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ userId: "operator" });
  m.generate.mockResolvedValue(claim); m.findUnique.mockResolvedValue(claim); m.findFirst.mockResolvedValue(claim);
  m.signed.mockResolvedValue("https://storage.example.com/signed");
});
describe("rutas del piloto PALIG", () => {
  it("rechaza acceso sin consultar ni mutar documentos", async () => {
    m.auth.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    expect((await POST(new Request("http://localhost/api/palig", { method: "POST" }))).status).toBe(403);
    expect((await GET(new Request("http://localhost/api/palig/claims/c1"), ctx)).status).toBe(403);
    expect((await retry(null, ctx)).status).toBe(403);
    expect(m.generate).not.toHaveBeenCalled(); expect(m.findFirst).not.toHaveBeenCalled(); expect(m.submit).not.toHaveBeenCalled();
  });
  it("si Hacienda falla devuelve el trámite creado y permite reintentar solo la emisión", async () => {
    m.submit.mockRejectedValue(new Error("private credential error"));
    const fd = new FormData(); fd.set("patientId", "u1"); fd.set("appointmentId", "a1"); fd.set("monto", "30000"); fd.set("confirmado", "true");
    const response = await POST(new Request("http://localhost/api/palig", { method: "POST", body: fd }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ invoiceId: "i1", invoiceReady: false });
    expect((await retry(null, ctx)).status).toBe(200);
    expect(m.generate).toHaveBeenCalledTimes(1);
    expect(m.submit).toHaveBeenCalledTimes(2);
  });
  it("descarga documentos privados con URL temporal y sin caché", async () => {
    const response = await GET(new Request("http://localhost/api/palig/claims/c1?file=form"), ctx);
    expect(response.status).toBe(307); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(m.signed).toHaveBeenCalledWith("insurance-signed-forms", "c1/palig/form.pdf", 120);
  });
  it("no firma una ruta de otro reclamo", async () => {
    m.findFirst.mockResolvedValue({ ...claim, generatedFormUrl: "insurance-signed-forms/other/palig/form.pdf" });
    expect((await GET(new Request("http://localhost/api/palig/claims/c1?file=form"), ctx)).status).toBe(404);
    expect(m.signed).not.toHaveBeenCalled();
  });
  it("no expone XML pendiente ni documentos de factura cancelada", async () => {
    expect((await GET(new Request("http://localhost/api/palig/claims/c1?file=xml"), ctx)).status).toBe(409);
    m.findFirst.mockResolvedValue({ ...claim, invoice: { ...claim.invoice, status: "CANCELLED" } });
    expect((await GET(new Request("http://localhost/api/palig/claims/c1?file=form"), ctx)).status).toBe(409);
    expect((await retry(null, ctx)).status).toBe(409);
    expect(m.submit).not.toHaveBeenCalled();
  });
});
