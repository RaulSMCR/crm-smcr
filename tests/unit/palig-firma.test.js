import { readFile } from "node:fs/promises";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";

const storage = vi.hoisted(() => ({ list: vi.fn(), download: vi.fn(), upload: vi.fn() }));
const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ storage: { from: () => storage } }) }));
vi.mock("@/lib/insurance-mail", () => ({ sendSignedClaimToPatient: mail.send }));

import { completarPalig, firmarPalig, moverFechaPalig, muestraFechaPalig, posicionFirmaPalig, POSICION_FIRMA_ESCANEO, prepararPlantillaPalig, validarPlantillaPalig } from "@/lib/palig-pdf";
import { enviarFirmadoPalig, firmarTramitePalig, moverFirmaTramitePalig, rutaFirmado, siguienteVersion } from "@/lib/palig-firma";

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

/** Cuántas veces aparece `texto` dibujado en el PDF (pdf-lib lo escribe en hexadecimal). */
async function vecesEscrito(bytes, texto) {
  const doc = await PDFDocument.load(bytes);
  const hex = Buffer.from(texto, "latin1").toString("hex").toUpperCase();
  let n = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    let contenido;
    try { contenido = Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1").toUpperCase(); } catch { continue; }
    n += contenido.split(`<${hex}>`).length - 1;
  }
  return n;
}

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
  it("en un escaneo estampa la firma en la posición de la plantilla y la anota en el firmado", async () => {
    const scan = await escaneada();
    const firmado = await firmarPalig(scan, scan, PNG);
    expect(await imagenesEnPagina(firmado)).toBe(1);
    expect(await posicionFirmaPalig(firmado)).toEqual(POSICION_FIRMA_ESCANEO);
  });
  it("en un escaneo repite la fecha de servicio en la casilla de junto a la firma", async () => {
    const plantilla = await validarPlantillaPalig(await escaneada());
    const formulario = await completarPalig(plantilla, { date: "2026-10-28T18:00:00Z", final: true });
    expect(await vecesEscrito(formulario, "28/10/26")).toBe(1);
    expect(await vecesEscrito(await firmarPalig(formulario, plantilla, PNG, { fecha: "2026-10-28T18:00:00Z" }), "28/10/26")).toBe(2);
    // La vista previa muestra las dos.
    expect(await vecesEscrito(await muestraFechaPalig(plantilla, new Date("2026-10-28T18:00:00Z")), "28/10/26")).toBe(2);
  });
  it("la casilla de la fecha junto a la firma se mueve sola, sin tocar las otras", async () => {
    const plantilla = await validarPlantillaPalig(await escaneada());
    const antes = (await PDFDocument.load(plantilla)).getKeywords();
    const despues = (await PDFDocument.load(await moverFechaPalig(plantilla, { dx: 3, cual: "fechaFirma" }))).getKeywords();
    const clave = (kw, prefijo) => kw.split(" ").find((k) => k.startsWith(prefijo));
    expect(clave(despues, "smcr-fecha-firma:")).not.toBe(clave(antes, "smcr-fecha-firma:"));
    expect(clave(despues, "smcr-fecha-atencion:")).toBe(clave(antes, "smcr-fecha-atencion:"));
    expect(clave(despues, "smcr-firma-medico:")).toBe(clave(antes, "smcr-firma-medico:"));
  });
  it("en un escaneo respeta la posición que se le pasa al correrla", async () => {
    const scan = await escaneada();
    const posicion = { x: 0.5, y: 0.1, w: 0.2, h: 0.05 };
    expect(await posicionFirmaPalig(await firmarPalig(scan, scan, PNG, { posicion }))).toEqual(posicion);
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

describe("firma en un formulario escaneado", () => {
  const claim = {
    id: "c2", professionalId: "p1", emailSentAt: null, firmadoAt: null,
    generatedFormUrl: "insurance-signed-forms/c2/palig/form.pdf", templateSnapshotUrl: "insurance-signed-forms/c2/palig/template.pdf",
    invoice: { status: "PAID", invoiceNumber: "0208", feStatus: "PENDING" },
  };
  const patient = { id: "u2", insuranceTemplateUrl: "insurance-templates/u2/palig-escaneada-a.pdf" };
  let db;
  let archivos;
  beforeEach(async () => {
    vi.resetAllMocks();
    const plantilla = await validarPlantillaPalig(await escaneada());
    const formulario = await completarPalig(plantilla, { date: "2026-10-28T18:00:00Z", final: true });
    archivos = { "c2/palig/form.pdf": formulario, "c2/palig/template.pdf": plantilla, "u2/palig-escaneada-a.pdf": plantilla, "firmas/raul-olmedo/firma-1.png": PNG, "firmas/raul-olmedo/firma-2.png": PNG };
    storage.list.mockResolvedValue({ data: [{ name: "firma-1.png" }, { name: "firma-2.png" }], error: null });
    storage.download.mockImplementation(async (path) => (archivos[path] ? { data: new Blob([archivos[path]]), error: null } : { data: null, error: new Error("no") }));
    storage.upload.mockImplementation(async (path, bytes) => { archivos[path] = bytes; return { error: null }; });
    db = {
      insuranceClaim: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(async ({ data }) => ({ ...claim, ...data })) },
      user: { update: vi.fn() },
    };
  });

  it("firma y avisa que se puede correr", async () => {
    const firmado = await firmarTramitePalig(db, claim, { ahora: new Date("2026-10-28T20:00:00Z") });
    expect(firmado).toMatchObject({ firmaVersion: 1, escaneada: true });
  });

  it("corre la firma con la misma versión, sobre el emitido, y la recuerda en la plantilla del paciente", async () => {
    const t1 = new Date("2026-10-28T20:00:00Z");
    const firmado = await firmarTramitePalig(db, claim, { ahora: t1 });
    const t2 = new Date("2026-10-28T20:01:00Z");
    const movido = await moverFirmaTramitePalig(db, { ...claim, ...firmado }, { dx: 6, dy: -6, patient, ahora: t2 });
    expect(movido).toMatchObject({ firmaVersion: 1, firmadoAt: t2, escaneada: true });

    const nuevo = archivos[`c2/palig/firmado-${t2.getTime()}.pdf`];
    const pos = await posicionFirmaPalig(nuevo);
    const page = (await PDFDocument.load(nuevo)).getPages()[0];
    expect(pos.x).toBeCloseTo(POSICION_FIRMA_ESCANEO.x + 6 / page.getWidth(), 3);
    expect(pos.y).toBeCloseTo(POSICION_FIRMA_ESCANEO.y - 6 / page.getHeight(), 3);
    // Una sola firma: se estampa sobre el emitido, no encima del firmado anterior.
    expect(await imagenesEnPagina(nuevo)).toBe(1);

    const [{ data }] = db.user.update.mock.calls[0];
    const recordada = archivos[data.insuranceTemplateUrl.slice("insurance-templates/".length)];
    expect((await posicionFirmaPalig(recordada)).x).toBeCloseTo(pos.x, 3);

    // Firmar con otra versión conserva la posición corrida.
    const otra = await firmarTramitePalig(db, { ...claim, ...movido }, { ahora: new Date("2026-10-28T20:02:00Z") });
    expect((await posicionFirmaPalig(archivos[`c2/palig/firmado-${otra.firmadoAt.getTime()}.pdf`])).x).toBeCloseTo(pos.x, 3);
  });

  it("no corre la firma de un formulario sin firmar ni la de uno editable", async () => {
    await expect(moverFirmaTramitePalig(db, claim, { dx: 6 })).rejects.toThrow("Primero firme");
    const { plantilla, formulario } = await editable();
    archivos["c2/palig/form.pdf"] = formulario; archivos["c2/palig/template.pdf"] = plantilla;
    const firmado = await firmarTramitePalig(db, claim, { ahora: new Date("2026-10-28T20:00:00Z") });
    expect(firmado.escaneada).toBe(false);
    await expect(moverFirmaTramitePalig(db, { ...claim, ...firmado }, { dx: 6 })).rejects.toThrow("lugar fijo");
  });
});
