import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  session: vi.fn(), profile: vi.fn(), claim: vi.fn(), update: vi.fn(), upload: vi.fn(), mail: vi.fn(), factura: vi.fn(), operador: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSession: m.session, isPreviewSession: () => false, PREVIEW_BLOCKED_MESSAGE: "bloqueado" }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  professionalProfile: { findUnique: m.profile },
  insuranceClaim: { findUnique: m.claim, update: m.update },
} }));
vi.mock("@/lib/storage", async (original) => ({ ...await original(), uploadPrivate: m.upload }));
vi.mock("@/lib/insurance-mail", () => ({ sendSignedClaimToPatient: m.mail }));
vi.mock("@/lib/palig-pdf", () => ({ facturaPaligPdf: m.factura }));
vi.mock("@/lib/fe/config", () => ({ FE_EMISOR: { nombre: "SMCR" } }));
vi.mock("@/lib/palig-auth", () => ({ requirePaligOperator: m.operador }));
import { POST } from "@/app/api/upload/insurance-signed-form/route";

const PDF = Buffer.from("%PDF-1.7 firmado");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const claim = { id: "c1", professionalId: "pro1", patient: { name: "Javier", email: "javier@example.com" }, invoice: { id: "i1", invoiceNumber: "0205" } };

function subir(bytes, type) {
  const fd = new FormData();
  fd.set("file", new File([bytes], "firmado", { type }));
  fd.set("claimId", "c1");
  return POST(new Request("http://localhost/api/upload/insurance-signed-form", { method: "POST", body: fd }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.session.mockResolvedValue({ role: "PROFESSIONAL", professionalProfileId: "pro1" });
  m.profile.mockResolvedValue({ isApproved: true });
  m.claim.mockResolvedValue(claim);
  m.mail.mockResolvedValue(true);
  m.factura.mockResolvedValue(Buffer.from("factura"));
});

describe("subir el formulario firmado", () => {
  it("lo guarda y se lo manda al paciente con el formulario y la factura adjuntos", async () => {
    const res = await subir(PDF, "application/pdf");
    expect(await res.json()).toEqual({ ok: true, emailSent: true, facturaAdjunta: true });
    const envio = m.mail.mock.calls[0][0];
    expect(envio.patientEmail).toBe("javier@example.com");
    expect(envio.formulario).toMatchObject({ filename: "Formulario-reclamo-firmado.pdf" });
    expect(Buffer.from(envio.formulario.content).toString()).toContain("firmado");
    expect(envio.factura).toMatchObject({ filename: "Factura-0205.pdf" });
    expect(m.update).toHaveBeenLastCalledWith({ where: { id: "c1" }, data: { emailSentAt: expect.any(Date) } });
  });

  it("si la factura todavía no está aceptada, manda el formulario solo", async () => {
    m.factura.mockRejectedValue(new Error("pendiente"));
    const res = await subir(PDF, "application/pdf");
    expect(await res.json()).toMatchObject({ emailSent: true, facturaAdjunta: false });
    expect(m.mail.mock.calls[0][0].factura).toBeNull();
  });

  it("acepta una foto o un escaneo en PNG", async () => {
    await subir(PNG, "image/png");
    expect(m.upload).toHaveBeenCalledWith("insurance-signed-forms", "c1/signed-form.png", expect.any(Buffer), "image/png");
  });

  it("no anota el correo como enviado si no salió", async () => {
    m.mail.mockResolvedValue(false);
    const res = await subir(PDF, "application/pdf");
    expect(await res.json()).toMatchObject({ ok: true, emailSent: false });
    expect(m.update).toHaveBeenCalledTimes(1);
    expect(m.update.mock.calls[0][0].data).not.toHaveProperty("emailSentAt");
  });

  it("rechaza un archivo cuyo contenido no coincide con su tipo, sin guardar ni enviar", async () => {
    const res = await subir(Buffer.from("no es un pdf"), "application/pdf");
    expect(res.status).toBe(400);
    expect(m.upload).not.toHaveBeenCalled(); expect(m.mail).not.toHaveBeenCalled();
  });

  it("el operador del piloto (admin) puede subir los de Raúl", async () => {
    m.session.mockResolvedValue({ role: "ADMIN" });
    m.operador.mockResolvedValue({ isAdmin: true });
    m.profile.mockResolvedValue({ id: "pro1" });
    expect((await subir(PDF, "application/pdf")).status).toBe(200);
    expect(m.mail).toHaveBeenCalledOnce();
  });

  it("un admin que no es el operador del piloto no puede", async () => {
    m.session.mockResolvedValue({ role: "ADMIN" });
    m.operador.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    expect((await subir(PDF, "application/pdf")).status).toBe(403);
    expect(m.upload).not.toHaveBeenCalled();
  });

  it("no deja subir el formulario de un trámite ajeno", async () => {
    m.claim.mockResolvedValue({ ...claim, professionalId: "otro" });
    expect((await subir(PDF, "application/pdf")).status).toBe(403);
    expect(m.upload).not.toHaveBeenCalled();
  });
});
