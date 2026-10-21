import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ register: vi.fn(), read: vi.fn(), download: vi.fn(), save: vi.fn(), validate: vi.fn(), fill: vi.fn() }));
vi.mock("@/lib/pagos-manuales", () => ({ registrarPagoManual: mocks.register }));
vi.mock("@/lib/palig-storage", () => ({ leerArchivoPalig: mocks.read, descargarPlantillaPalig: mocks.download, guardarPalig: mocks.save }));
vi.mock("@/lib/palig-pdf", async (original) => ({ ...await original(), validarPlantillaPalig: mocks.validate, completarPalig: mocks.fill }));
import { generarAtencionPalig, resumenPalig } from "@/lib/palig-service";

const cita = { id: "a1", patientId: "u1", professionalId: "p1", date: new Date("2026-10-20T16:00:00Z"), status: "CONFIRMED", paymentStatus: "UNPAID", patient: { name: "Prueba", insuranceName: "PALIG", insuranceTemplateUrl: "insurance-templates/u1/a.pdf", insuranceTemplateProId: "p1" }, professional: { slug: "raul-olmedo", user: { name: "Raúl" } } };
const claim = { id: "c1", invoiceId: "i1", generatedFormUrl: "private/form.pdf", invoice: { invoiceNumber: "1", total: 30000, feStatus: "ACCEPTED", feNumber: "001", feXml: "PRIVATE_XML", status: "PAID" } };
const params = { appointmentId: "a1", monto: 30000, confirmado: true, proof: {}, userId: "operator" };
let db;
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T18:00:00Z"));
  db = { appointment: { findUnique: vi.fn().mockResolvedValue(cita) }, insuranceClaim: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(claim) } };
  mocks.read.mockResolvedValue({ bytes: Buffer.from("proof"), mime: "image/png", extension: "png" });
  mocks.download.mockResolvedValue(Buffer.from("original")); mocks.validate.mockResolvedValue(Buffer.from("template")); mocks.fill.mockResolvedValue(Buffer.from("filled"));
  mocks.save.mockImplementation(async (bucket, path) => `${bucket}/${path}`); mocks.register.mockResolvedValue({ ok: true });
});
afterEach(() => vi.useRealTimers());

describe("orquestación PALIG sin servicios reales", () => {
  it("guarda tres copias privadas antes del cobro y fija la misma fecha para PDF y factura", async () => {
    expect(await generarAtencionPalig(db, params)).toEqual(claim);
    expect(mocks.save).toHaveBeenCalledTimes(3);
    expect(mocks.save.mock.invocationCallOrder[2]).toBeLessThan(mocks.register.mock.invocationCallOrder[0]);
    const data = mocks.register.mock.calls[0][1];
    expect(data).toMatchObject({ cuenta: "SINPE_MOVIL", tipo: "FULL_100", monto: 30000, registradoPor: "operator", fechaPago: new Date("2026-10-20T18:00:00Z"), palig: { patientName: "Prueba", sourceTemplateUrl: cita.patient.insuranceTemplateUrl } });
    expect(mocks.fill.mock.calls[0][1].date).toEqual(data.fechaPago);
    expect(data.palig.paymentProofUrl).toContain(`${data.palig.claimId}/palig/proof.png`);
  });
  it("recupera documentos existentes sin repetir el cobro ni leer un comprobante", async () => {
    db.insuranceClaim.findUnique.mockReset().mockResolvedValue(claim);
    db.appointment.findUnique.mockResolvedValue({ ...cita, paymentStatus: "PAID" });
    expect(await generarAtencionPalig(db, params)).toBe(claim);
    expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("un fallo de Storage nunca registra el pago", async () => {
    mocks.save.mockRejectedValue(new Error("Storage unavailable"));
    await expect(generarAtencionPalig(db, params)).rejects.toThrow();
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("un comprobante inválido nunca registra el pago", async () => {
    mocks.read.mockRejectedValue(new Error("invalid proof"));
    await expect(generarAtencionPalig(db, params)).rejects.toThrow();
    expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rechaza citas ajenas y de otro día antes de guardar archivos", async () => {
    for (const change of [{ professional: { slug: "otro" } }, { date: new Date("2026-10-19T18:00:00Z") }]) {
      db.appointment.findUnique.mockResolvedValue({ ...cita, ...change });
      await expect(generarAtencionPalig(db, params)).rejects.toThrow();
    }
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each([NaN, 0, -1, 10.001, 100000000])("rechaza monto inválido %s", async (monto) => {
    await expect(generarAtencionPalig(db, { ...params, monto })).rejects.toThrow();
    expect(db.appointment.findUnique).not.toHaveBeenCalled();
  });
  it("resuelve la colisión de dos envíos al mismo trámite", async () => {
    mocks.register.mockRejectedValue({ code: "P2002" });
    expect(await generarAtencionPalig(db, params)).toBe(claim);
    expect(mocks.register).toHaveBeenCalledTimes(1);
  });
  it("no reemplaza un trámite de seguro previo ni omite confirmación", async () => {
    db.insuranceClaim.findUnique.mockReset().mockResolvedValue({ id: "legacy" });
    await expect(generarAtencionPalig(db, params)).rejects.toMatchObject({ status: 409 });
    await expect(generarAtencionPalig(db, { ...params, confirmado: false })).rejects.toThrow("Confirme");
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("la respuesta no expone XML, respaldos ni datos clínicos", () => {
    expect(resumenPalig(claim).invoiceReady).toBe(true);
    expect(JSON.stringify(resumenPalig(claim))).not.toContain("PRIVATE_XML");
    expect(resumenPalig({ ...claim, invoice: { ...claim.invoice, feXml: null } }).invoiceReady).toBe(false);
  });
});
