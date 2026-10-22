import { readFile, mkdir, writeFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { completarPalig, validarPlantillaPalig, facturaPaligPdf, fechaPalig } from "@/lib/palig-pdf";
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
  it("exige el formulario PALIG editable, sin exigir contenido: eso queda a cargo de Raúl", async () => {
    await expect(validarPlantillaPalig(await source())).resolves.toBeInstanceOf(Buffer);
    await expect(validarPlantillaPalig(Buffer.from("invalid"))).rejects.toThrow("PDF");
    const other = await PDFDocument.create(); other.addPage();
    await expect(validarPlantillaPalig(await other.save())).rejects.toThrow("formulario PALIG");
    const moved = await PDFDocument.load(await prepared());
    moved.getForm().getTextField(F.serviceDate).acroField.getWidgets()[0].setRectangle({ x: 1, y: 1, width: 100, height: 20 });
    await expect(validarPlantillaPalig(await moved.save())).rejects.toThrow("campos editables");
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
    await expect(validarPlantillaPalig(output)).rejects.toThrow("editables");
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
