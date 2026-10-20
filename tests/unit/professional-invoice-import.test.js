import { beforeEach, describe, expect, it, vi } from "vitest";
import { supplierXml, supplierId, supplierClave, supplierConsecutive } from "../fixtures/supplier-invoice";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), preview: vi.fn(), profile: vi.fn(), create: vi.fn(), settlement: vi.fn(), update: vi.fn(),
  download: vi.fn(), upload: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session, isPreviewSession: mocks.preview, PREVIEW_BLOCKED_MESSAGE: "Vista previa" }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  professionalProfile: { findUnique: mocks.profile }, invoice: { create: mocks.create },
  settlement: { findFirst: mocks.settlement, update: mocks.update },
} }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ storage: { from: () => ({ download: mocks.download, upload: mocks.upload }) } }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { submitProfessionalInvoice } from "@/actions/professional-billing-actions";
import { POST } from "@/app/api/upload/professional-invoice/route";
import { professionalInvoiceFile } from "@/lib/supplier-invoice-files";

const args = { fileUrl: "/api/files?path=professional-invoices%2Fpro1%2Ftest.pdf", xmlUrl: "/api/files?path=professional-invoices%2Fpro1%2Ftest.xml" };
function request(content = supplierXml, type = "text/xml", name = "factura.xml") {
  const body = new FormData();
  body.set("file", new File([content], name, { type }));
  return new Request("http://localhost/api/upload/professional-invoice", { method: "POST", body });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ role: "PROFESSIONAL", userId: "user1", professionalProfileId: "pro1" });
  mocks.profile.mockResolvedValue({ id: "pro1", userId: "user1", isApproved: true, user: { identification: supplierId } });
  mocks.download.mockResolvedValue({ data: new Blob([supplierXml], { type: "text/xml" }), error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.create.mockResolvedValue({ id: "invoice1" });
});

describe("lectura automática al adjuntar XML", () => {
  it("devuelve la vista previa sin crear una factura y conserva el XML original", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).invoiceData).toMatchObject({ referenceNumber: supplierConsecutive, amount: 10400 });
    expect(mocks.upload.mock.calls[0][1].toString("utf8")).toBe(supplierXml);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rechaza XML inválido antes de subirlo", async () => {
    const response = await POST(request("<html>archivo ajeno</html>"));
    expect(response.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("mantiene la subida de PDF y verifica su contenido", async () => {
    expect((await POST(request("%PDF-1.7\ncontenido", "application/pdf", "factura.pdf"))).status).toBe(200);
    expect((await POST(request("texto", "application/pdf", "factura.pdf"))).status).toBe(400);
  });

  it("comprueba el ownership del perfil y bloquea vistas previas", async () => {
    mocks.profile.mockResolvedValue({ isApproved: true, userId: "otro" });
    expect((await POST(request())).status).toBe(403);
    mocks.preview.mockReturnValue(true);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});

describe("presentación verificada en servidor", () => {
  it("ignora datos manipulados del formulario y guarda los del XML privado", async () => {
    const result = await submitProfessionalInvoice({ ...args, amount: 1, referenceNumber: "FALSO", supplierFeClave: "falsa" });
    expect(result.success).toBe(true);
    expect(mocks.download).toHaveBeenCalledWith("pro1/test.xml");
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      supplierReference: supplierConsecutive, supplierFeClave: supplierClave, supplierIdNumber: supplierId,
      invoiceDate: new Date("2026-07-15T23:30:00-06:00"), total: 10400, taxAmount: 400, subtotal: 10000,
      acceptanceStatus: "PENDING", lines: { create: [{ productName: "Honorarios de prueba", lineTotal: 10400 }] },
    });
  });

  it("comprueba el total real del XML contra la liquidación", async () => {
    mocks.settlement.mockResolvedValue({ id: "s1", netAmount: 500, taxRatePct: 4 });
    expect(await submitProfessionalInvoice({ ...args, settlementId: "s1", amount: 500 })).toMatchObject({ success: false, error: expect.stringMatching(/neto/) });
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.settlement.mockResolvedValue({ id: "s1", netAmount: 10400, taxRatePct: 4 });
    expect((await submitProfessionalInvoice({ ...args, settlementId: "s1" })).success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { invoiceId: "invoice1", status: "INVOICED" } });
  });

  it.each(["https://example.com/invoice.xml", "professional-invoices/otro/test.xml", "professional-invoices/pro1/../otro.xml", "/api/files?path=CVS%2Fpro1%2Ftest.xml"])("rechaza referencias ajenas: %s", async (xmlUrl) => {
    expect((await submitProfessionalInvoice({ ...args, xmlUrl })).success).toBe(false);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rechaza PDF de otro profesional y XML que ya no se puede leer", async () => {
    expect(() => professionalInvoiceFile("professional-invoices/otro/test.pdf", "pro1", "pdf")).toThrow();
    mocks.download.mockResolvedValue({ error: { message: "detalle privado" }, data: null });
    expect(await submitProfessionalInvoice(args)).toEqual({ success: false, error: "No se pudo leer el XML adjunto. Vuelva a seleccionarlo." });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rechaza sesión ausente, perfil no aprobado y vista previa sin leer archivos", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await submitProfessionalInvoice(args)).success).toBe(false);
    mocks.session.mockResolvedValue({ role: "PROFESSIONAL", userId: "user1" });
    mocks.profile.mockResolvedValue({ isApproved: false });
    expect((await submitProfessionalInvoice(args)).success).toBe(false);
    mocks.preview.mockReturnValue(true);
    expect((await submitProfessionalInvoice(args)).success).toBe(false);
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
