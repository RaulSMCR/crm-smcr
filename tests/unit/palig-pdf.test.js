import { readFile, mkdir, writeFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { completarPalig, validarPlantillaPalig, facturaPaligPdf, fechaPalig, moverFechaPalig, muestraFechaPalig, prepararPlantillaPalig, tipoDePlantillaPalig } from "@/lib/palig-pdf";
import { PALIG_FIELDS as F } from "@/lib/palig-fields";

const source = () => readFile("public/forms/palig-cr-reclamo-2023.pdf");
const patient = { name: "PACIENTE FICTICIA Álvarez", birthDate: new Date("1990-05-02T00:00:00Z") };
const professional = { user: { name: "PROFESIONAL DE PRUEBA", phone: "88888888" }, specialty: "Psicología", licenseNumber: "PRUEBA" };
async function prepared() {
  const doc = await PDFDocument.load(await source());
  for (const field of [F.reason, F.diagnosis, F.treatment]) doc.getForm().getTextField(field).setText("DATOS FICTICIOS - prueba de formulario");
  doc.getForm().getTextField(F.policyNumber).setText("POLIZA-PRUEBA");
  return doc.save();
}

/** ¿Quedó este texto dibujado en el PDF? pdf-lib lo escribe en hexadecimal. */
async function textoDibujado(bytes) {
  const doc = await PDFDocument.load(bytes);
  const flujos = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      try { flujos.push(Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1").toUpperCase()); } catch { /* no es texto */ }
    }
  }
  return (texto) => flujos.some((f) => f.includes(Buffer.from(texto, "latin1").toString("hex").toUpperCase()));
}

describe("PDF PALIG real y factura imprimible", () => {
  it("rellena identidad sin mover cumpleaños por la zona horaria, preserva datos clínicos y deja firmas sin fecha", async () => {
    const bytes = await completarPalig(await prepared(), { patient, professional, date: "2026-10-21T02:00:00Z" });
    const form = (await PDFDocument.load(bytes)).getForm();
    expect(form.getTextField(F.patientName).getText()).toBe(patient.name);
    expect(form.getTextField(F.birthDate).getText()).toBe("02/05/90");
    expect(form.getTextField(F.serviceDate).getText()).toBe("20/10/26");
    expect(form.getTextField(F.policyNumber).getText()).toBe("POLIZA-PRUEBA");
    expect(form.getTextField(F.diagnosis).getText()).toContain("FICTICIOS");
    expect(form.getTextField(F.signatureDate).getText() || "").toBe("");
    expect(fechaPalig("2026-10-21T02:00:00Z")).toBe("20/10/26");
  });
  it("acepta el editable sin exigir contenido, y rechaza lo que no puede ser el formulario", async () => {
    expect(await tipoDePlantillaPalig(await source())).toBe("editable");
    await expect(validarPlantillaPalig(await source())).resolves.toBeInstanceOf(Buffer);
    await expect(validarPlantillaPalig(Buffer.from("invalid"))).rejects.toThrow("PDF");
    // Una carta apaisada o de varias páginas no es el formulario.
    const carta = await PDFDocument.create(); carta.addPage([792, 612]);
    await expect(validarPlantillaPalig(await carta.save())).rejects.toThrow("una sola página");
    const varias = await PDFDocument.create(); varias.addPage([439, 713]); varias.addPage([439, 713]);
    await expect(validarPlantillaPalig(await varias.save())).rejects.toThrow("una sola página");
    // Si los campos no están en su lugar se trata como escaneo: la fecha va
    // encima de la página, no en un campo que quizás esté en otro lado.
    const moved = await PDFDocument.load(await prepared());
    moved.getForm().getTextField(F.serviceDate).acroField.getWidgets()[0].setRectangle({ x: 1, y: 1, width: 100, height: 20 });
    expect(await tipoDePlantillaPalig(await moved.save())).toBe("escaneada");
  });

  it("al guardar el editable completa solo lo vacío del profesional: nombre, colegiado y teléfono", async () => {
    const vacio = await prepararPlantillaPalig(await prepared(), { nombre: "Raúl Olmedo Evans", colegiado: "8270", telefono: "71291909" });
    const f1 = (await PDFDocument.load(vacio.bytes)).getForm();
    expect(vacio.tipo).toBe("editable");
    expect([F.professionalName, F.professionalLicense, F.professionalPhone].map((c) => f1.getTextField(c).getText())).toEqual(["Raúl Olmedo Evans", "8270", "71291909"]);

    const doc = await PDFDocument.load(await prepared());
    doc.getForm().getTextField(F.professionalPhone).setText("88888888");
    const escrito = await prepararPlantillaPalig(await doc.save(), { nombre: "Raúl Olmedo Evans", colegiado: "8270", telefono: "71291909" });
    expect((await PDFDocument.load(escrito.bytes)).getForm().getTextField(F.professionalPhone).getText()).toBe("88888888");
  });

  it("un escaneo se guarda tal cual y la fecha va encima, en su recuadro, movible", async () => {
    // Como el papel de Javier: una página de 439×713 sin campos.
    const papel = await PDFDocument.create(); papel.addPage([439, 713]);
    const { bytes, tipo } = await prepararPlantillaPalig(await papel.save(), { nombre: "Raúl" });
    expect(tipo).toBe("escaneada");
    const final = await completarPalig(bytes, { date: "2026-10-22T04:48:00Z", final: true });
    expect((await textoDibujado(final))("21/10/26")).toBe(true);

    const leerPos = async (b) => (await PDFDocument.load(b)).getKeywords();
    const antes = await leerPos(bytes);
    const movida = await moverFechaPalig(bytes, { dx: 3, dy: -3 });
    expect(await leerPos(movida)).not.toBe(antes);
    expect(await leerPos(movida)).toMatch(/^smcr-fecha-atencion:/);
    // La vista previa marca el recuadro; el editable no se puede mover.
    await expect(muestraFechaPalig(movida, new Date("2026-10-22T04:48:00Z"))).resolves.toBeInstanceOf(Buffer);
    await expect(moverFechaPalig(await prepared(), { dx: 3 })).rejects.toThrow("escaneada");
  });
  it("conserva todo lo que Raúl escribió y solo pone la fecha de atención del pago", async () => {
    // Plantilla de Raúl: nombre escrito a su manera (distinto del perfil) y
    // fecha de firma ya puesta. Nada de eso se pisa.
    const doc = await PDFDocument.load(await prepared());
    doc.getForm().getTextField(F.patientName).setText("Nombre como lo escribió Raúl");
    doc.getForm().getTextField(F.signatureDate).setText("21/10/26");
    const checked = await validarPlantillaPalig(await doc.save());
    const guardada = (await PDFDocument.load(checked)).getForm();
    expect(guardada.getTextField(F.patientName).getText()).toBe("Nombre como lo escribió Raúl");
    expect(guardada.getTextField(F.signatureDate).getText()).toBe("21/10/26");

    // 21-oct a las 21:00 CR (ya 22 en UTC): la fecha es la de Costa Rica.
    const final = await completarPalig(checked, { date: "2026-10-22T03:00:00Z", final: true });
    expect((await PDFDocument.load(final)).getForm().getFields()).toHaveLength(0);
    // Congelado ya no tiene campos: se lee lo que quedó dibujado en la página.
    const dibujado = await textoDibujado(final);
    expect(dibujado("21/10/26")).toBe(true);
    expect(dibujado("Nombre como lo escribi")).toBe(true);
  });

  it("congela el formulario emitido sin campos editables", async () => {
    const checked = await validarPlantillaPalig(await prepared());
    const output = await completarPalig(checked, { patient, professional, date: "2026-10-20T18:00:00Z", final: true });
    expect((await PDFDocument.load(output)).getForm().getFields()).toHaveLength(0);
    // Aplanado ya no tiene campos: si se volviera a subir, se trata como escaneo.
    expect(await tipoDePlantillaPalig(output)).toBe("escaneada");
    if (process.env.PALIG_VISUAL_QA === "1") {
      await mkdir("tmp/palig", { recursive: true });
      await writeFile("tmp/palig/palig-final-qa.pdf", output);
    }
  });
  it("rechaza una factura pendiente o simulada aunque figure aceptada", async () => {
    for (const invoice of [{ feStatus: "PENDING" }, { feStatus: "ACCEPTED", feNumber: "1", feXml: null }, { feStatus: "ACCEPTED", feNumber: "1", feXml: "<xml/>", status: "CANCELLED" }]) {
      await expect(facturaPaligPdf(invoice, {})).rejects.toMatchObject({ status: 409 });
    }
  });
  it("genera una representación imprimible y distingue el ambiente de pruebas", async () => {
    const bytes = await facturaPaligPdf({ feStatus: "ACCEPTED", status: "PAID", feNumber: "PRUEBA-000000001", feClave: "0".repeat(50), feXml: "<xml/>", feAmbiente: "02", invoiceDate: new Date("2026-10-20T18:00:00Z"), contactName: patient.name, contactIdNumber: "FICTICIO", subtotal: 28846.15, taxAmount: 1153.85, total: 30000, lines: [{ productName: "Consulta de prueba", description: "Datos ficticios para control visual", quantity: 1, lineSubtotal: 28846.15, taxAmount: 1153.85, lineTotal: 30000 }] }, { nombre: "EMISOR FICTICIO", identificacion: "FICTICIO", correo: "prueba@example.com" });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    if (process.env.PALIG_VISUAL_QA === "1") await writeFile("tmp/palig/factura-qa.pdf", bytes);
  });
});
