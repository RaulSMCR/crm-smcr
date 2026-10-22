import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ register: vi.fn(), read: vi.fn(), download: vi.fn(), save: vi.fn(), validate: vi.fn(), fill: vi.fn() }));
vi.mock("@/lib/pagos-manuales", () => ({ registrarPagoManual: mocks.register }));
vi.mock("@/lib/palig-storage", () => ({ leerArchivoPalig: mocks.read, descargarPlantillaPalig: mocks.download, guardarPalig: mocks.save }));
vi.mock("@/lib/palig-pdf", async (original) => ({ ...await original(), validarPlantillaPalig: mocks.validate, completarPalig: mocks.fill }));
import { generarPagoPalig, resumenPalig } from "@/lib/palig-service";

// 21-oct-2026 a las 17:00 CR.
const AHORA = new Date("2026-10-21T23:00:00Z");
const paciente = { id: "u1", name: "Prueba", isActive: true, insuranceName: "PALIG", insuranceTemplateUrl: "insurance-templates/u1/a.pdf", insuranceTemplateProId: "p1" };
const cita = { id: "a1", patientId: "u1", professionalId: "p1", date: new Date("2026-10-14T22:00:00Z"), status: "COMPLETED", paymentStatus: "UNPAID", professional: { slug: "raul-olmedo" } };
const claim = { id: "c1", invoiceId: "i1", generatedFormUrl: "private/form.pdf", invoice: { invoiceNumber: "1", total: 40000, feStatus: "ACCEPTED", feNumber: "001", feXml: "PRIVATE_XML", status: "PAID" } };
const params = { patientId: "u1", monto: 40000, confirmado: true, proof: {}, userId: "operator" };
let db;
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(AHORA);
  db = {
    professionalProfile: { findUnique: vi.fn().mockResolvedValue({ id: "p1", slug: "raul-olmedo", user: { name: "Raúl" } }) },
    user: { findUnique: vi.fn().mockResolvedValue(paciente) },
    appointment: { findUnique: vi.fn().mockResolvedValue(cita), findFirst: vi.fn().mockResolvedValue({ serviceId: "svc1" }) },
    serviceAssignment: { findFirst: vi.fn().mockResolvedValue({ serviceId: "svc-asig" }) },
    insuranceClaim: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
  };
  db.insuranceClaim.findUnique.mockImplementation(async ({ where }) => (where.id ? claim : null));
  mocks.read.mockResolvedValue({ bytes: Buffer.from("proof"), mime: "image/png", extension: "png" });
  mocks.download.mockResolvedValue(Buffer.from("original")); mocks.validate.mockResolvedValue(Buffer.from("template")); mocks.fill.mockResolvedValue(Buffer.from("filled"));
  mocks.save.mockImplementation(async (bucket, path) => `${bucket}/${path}`); mocks.register.mockResolvedValue({ ok: true });
});
afterEach(() => vi.useRealTimers());

describe("pago PALIG por comprobante", () => {
  it("sin sesión: factura suelta con fecha de hoy y formulario con la misma fecha", async () => {
    expect(await generarPagoPalig(db, params)).toEqual(claim);
    expect(mocks.save).toHaveBeenCalledTimes(3);
    expect(mocks.save.mock.invocationCallOrder[2]).toBeLessThan(mocks.register.mock.invocationCallOrder[0]);
    const data = mocks.register.mock.calls[0][1];
    expect(data).toMatchObject({ contactId: "u1", serviceId: "svc1", cuenta: "SINPE_MOVIL", monto: 40000, fechaPago: AHORA, registradoPor: "operator", descripcion: "Atención del 21/10/2026" });
    expect(data.appointmentId).toBeUndefined();
    // El formulario final solo recibe la fecha: la plantilla de Raúl no se pisa.
    expect(mocks.fill.mock.calls[0][1]).toEqual({ date: AHORA, final: true });
    expect(data.palig).toMatchObject({ patientName: "Prueba", sourceTemplateUrl: paciente.insuranceTemplateUrl, pagoConfirmado: true });
    expect(data.palig.paymentProofUrl).toContain(`${data.palig.claimId}/palig/proof.png`);
  });

  it("con sesión de otro día: la deja pagada y la factura sigue siendo de hoy", async () => {
    await generarPagoPalig(db, { ...params, appointmentId: "a1" });
    const data = mocks.register.mock.calls[0][1];
    expect(data).toMatchObject({ appointmentId: "a1", tipo: "FULL_100", fechaPago: AHORA });
    expect(mocks.fill.mock.calls[0][1].date).toEqual(AHORA);
  });

  it("si el paciente no tiene sesiones, factura con el servicio de Raúl", async () => {
    db.appointment.findFirst.mockResolvedValue(null);
    await generarPagoPalig(db, params);
    expect(mocks.register.mock.calls[0][1].serviceId).toBe("svc-asig");
  });

  it("un segundo envío del mismo día sin sesión no emite otra factura", async () => {
    db.insuranceClaim.findFirst.mockResolvedValue(claim);
    await expect(generarPagoPalig(db, params)).rejects.toMatchObject({ status: 409 });
    expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });

  it("con sesión ya tramitada, devuelve los documentos existentes sin cobrar de nuevo", async () => {
    db.insuranceClaim.findUnique.mockResolvedValue(claim);
    expect(await generarPagoPalig(db, { ...params, appointmentId: "a1" })).toBe(claim);
    expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });

  it("un fallo de Storage nunca registra el pago", async () => {
    mocks.save.mockRejectedValue(new Error("Storage unavailable"));
    await expect(generarPagoPalig(db, params)).rejects.toThrow();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("un comprobante inválido nunca registra el pago", async () => {
    mocks.read.mockRejectedValue(new Error("invalid proof"));
    await expect(generarPagoPalig(db, params)).rejects.toThrow();
    expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rechaza paciente sin PALIG, sin plantilla o sesión ajena antes de guardar archivos", async () => {
    for (const cambio of [{ insuranceName: "INS" }, { insuranceTemplateUrl: null }]) {
      db.user.findUnique.mockResolvedValue({ ...paciente, ...cambio });
      await expect(generarPagoPalig(db, params)).rejects.toThrow();
    }
    db.user.findUnique.mockResolvedValue(paciente);
    db.appointment.findUnique.mockResolvedValue({ ...cita, patientId: "otro" });
    await expect(generarPagoPalig(db, { ...params, appointmentId: "a1" })).rejects.toThrow("otro paciente");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each([NaN, 0, -1, 10.001, 100000000])("rechaza monto inválido %s", async (monto) => {
    await expect(generarPagoPalig(db, { ...params, monto })).rejects.toThrow();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("exige confirmar el pago y elegir paciente", async () => {
    await expect(generarPagoPalig(db, { ...params, confirmado: false })).rejects.toThrow("Confirme");
    await expect(generarPagoPalig(db, { ...params, patientId: "" })).rejects.toThrow("paciente");
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("resuelve la colisión de dos envíos simultáneos", async () => {
    mocks.register.mockRejectedValue({ code: "P2034" });
    db.insuranceClaim.findFirst.mockResolvedValueOnce(null).mockResolvedValue(claim);
    expect(await generarPagoPalig(db, params)).toBe(claim);
    expect(mocks.register).toHaveBeenCalledTimes(1);
  });

  it("la respuesta no expone XML, respaldos ni datos clínicos", () => {
    expect(resumenPalig(claim).invoiceReady).toBe(true);
    expect(JSON.stringify(resumenPalig(claim))).not.toContain("PRIVATE_XML");
    expect(resumenPalig({ ...claim, invoice: { ...claim.invoice, feXml: null } }).invoiceReady).toBe(false);
  });
});
