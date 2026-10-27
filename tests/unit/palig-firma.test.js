import { readFile } from "node:fs/promises";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";

const storage = vi.hoisted(() => ({ list: vi.fn(), download: vi.fn(), upload: vi.fn() }));
const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ storage: { from: () => storage } }) }));
vi.mock("@/lib/insurance-mail", () => ({ sendSignedClaimToPatient: mail.send }));

import { completarPalig, firmarPalig, prepararPlantillaPalig } from "@/lib/palig-pdf";
import { enviarFirmadoPalig, firmarTramitePalig, rutaFirmado, siguienteVersion } from "@/lib/palig-firma";

// PNG transparente de 1 × 1: basta para comprobar dónde y cómo se estampa.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function editable() {
  const { bytes } = await prepararPlantillaPalig(await readFile("public/forms/palig-cr-reclamo-2023.pdf"), { nombre: "PROFESIONAL DE PRUEBA" });
  return { plantilla: bytes, formulario: await completarPalig(bytes, { date: "2026-10-27T18:00:00Z", final: true }) };
}
async function escaneada() {
  const doc = await PDFDocument.create(); doc.addPage([439, 713]);
  return Buffer.from(await doc.save());
}
const imagenesEnPagina = async (bytes) => {
  const page = (await PDFDocument.load(bytes)).getPages()[0];
  const xobjects = page.node.Resources()?.lookup(PDFName.of("XObject"));
  return xobjects ? xobjects.keys().length : 0;
};

describe("rotación de la firma", () => {
  it("usa una versión distinta cada vez y vuelve a empezar", () => {
    expect(siguienteVersion([1, 2, 3], null)).toBe(1);
    expect(siguienteVersion([1, 2, 3], 1)).toBe(2);
    expect(siguienteVersion([1, 2, 3], 3)).toBe(1);
    // Si se retiró la versión usada, sigue con la próxima que exista.
    expect(siguienteVersion([1, 4, 6], 2)).toBe(4);
    expect(() => siguienteVersion([], null)).toThrow("firmas guardadas");
  });
});

describe("firma en el PDF", () => {
  it("estampa la firma en el formulario emitido desde el editable", async () => {
    const { plantilla, formulario } = await editable();
    const antes = await imagenesEnPagina(formulario);
    expect(await imagenesEnPagina(await firmarPalig(formulario, plantilla, PNG))).toBe(antes + 1);
  });
  it("no firma un formulario que salió de una plantilla escaneada", async () => {
    const scan = await escaneada();
    await expect(firmarPalig(scan, scan, PNG)).rejects.toThrow("escaneada");
  });
});

describe("firmar y enviar el trámite", () => {
  const claim = {
    id: "c1", professionalId: "p1", emailSentAt: null, firmadoAt: null,
    generatedFormUrl: "insurance-signed-forms/c1/palig/form.pdf", templateSnapshotUrl: "insurance-signed-forms/c1/palig/template.pdf",
    invoice: { status: "PAID", invoiceNumber: "0201", feStatus: "PENDING" },
  };
  let db;
  beforeEach(async () => {
    vi.resetAllMocks();
    const { plantilla, formulario } = await editable();
    const archivos = { "c1/palig/form.pdf": formulario, "c1/palig/template.pdf": plantilla, "firmas/raul-olmedo/firma-2.png": PNG, "firmas/raul-olmedo/firma-3.png": PNG };
    storage.list.mockResolvedValue({ data: [{ name: "firma-2.png" }, { name: "firma-3.png" }, { name: "notas.txt" }], error: null });
    storage.download.mockImplementation(async (path) => (archivos[path] ? { data: new Blob([archivos[path]]), error: null } : { data: null, error: new Error("no") }));
    storage.upload.mockImplementation(async (path, bytes) => { archivos[path] = bytes; return { error: null }; });
    db = { insuranceClaim: { findFirst: vi.fn(), update: vi.fn(async ({ data }) => ({ ...claim, ...data })) } };
  });

  it("firma con la versión que sigue a la última usada y guarda el PDF sin pisar nada", async () => {
    db.insuranceClaim.findFirst.mockResolvedValue({ firmaVersion: 2 });
    const ahora = new Date("2026-10-27T20:00:00Z");
    const firmado = await firmarTramitePalig(db, claim, { ahora });
    expect(firmado).toMatchObject({ firmaVersion: 3, firmadoAt: ahora });
    expect(storage.upload).toHaveBeenCalledWith(`c1/palig/firmado-${ahora.getTime()}.pdf`, expect.any(Buffer), expect.objectContaining({ upsert: false }));
    // Firmar no envía nada ni marca el trámite como completo.
    expect(db.insuranceClaim.update).toHaveBeenCalledWith(expect.objectContaining({ data: { firmaVersion: 3, firmadoAt: ahora } }));
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("envía el firmado al paciente y lo deja como el formulario del trámite", async () => {
    db.insuranceClaim.findFirst.mockResolvedValue(null);
    const ahora = new Date("2026-10-27T20:00:00Z");
    await firmarTramitePalig(db, claim, { ahora });
    mail.send.mockResolvedValue(true);
    const firmado = { ...claim, firmaVersion: 2, firmadoAt: ahora };
    const result = await enviarFirmadoPalig(db, firmado, { patient: { name: "Paciente", email: "p@example.com" } });
    expect(result).toEqual({ emailSent: true, facturaAdjunta: false });
    expect(db.insuranceClaim.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ signedFormUrl: rutaFirmado(firmado), status: "COMPLETED" }) }));
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ patientEmail: "p@example.com", formulario: expect.objectContaining({ filename: "Formulario-reclamo-firmado.pdf" }) }));
    expect(db.insuranceClaim.update).toHaveBeenLastCalledWith({ where: { id: "c1" }, data: { emailSentAt: expect.any(Date) } });
  });

  it("no firma ni envía lo ya enviado, lo cancelado o lo que no se firmó", async () => {
    await expect(firmarTramitePalig(db, { ...claim, emailSentAt: new Date() })).rejects.toThrow("ya se envió");
    await expect(firmarTramitePalig(db, { ...claim, invoice: { status: "CANCELLED" } })).rejects.toThrow("cancelada");
    await expect(enviarFirmadoPalig(db, claim, { patient: {} })).rejects.toThrow("Primero firme");
    expect(storage.upload).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });
});
