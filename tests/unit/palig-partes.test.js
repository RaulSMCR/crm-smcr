import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  diaPalig,
  formularioDelPaciente,
  formularioDelPacienteDesdeArchivo,
  leerDatosPalig,
  plantillaConParteProfesional,
  tipoDePlantillaPalig,
} from "@/lib/palig-pdf";
import { PALIG_FIELDS as F } from "@/lib/palig-fields";

// PNG transparente de 1 × 1: alcanza para estampar una firma.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const enBlanco = () => readFile("public/forms/palig-cr-reclamo-2023.pdf");

const PACIENTE = {
  empresa: "Empresa Ejemplo S.A.",
  poliza: "PL-12345",
  certificado: "77",
  nombre: "Paciente de Prueba",
  nacimiento: "1990-03-05",
  telefono: "88888888",
  correo: "paciente@example.com",
  sexo: "F",
  parentesco: "titular",
  tipoDeReclamo: "enfermedad",
};
const PROFESIONAL = { nombre: "Profesional de Prueba", especialidad: "Psicología clínica", colegiado: "PSI-1234", telefono: "71291909" };
const PARTE_PRO = { motivo: "Ansiedad", diagnostico: "F41.1", tratamiento: "Psicoterapia semanal", congenita: "no", lugar: "consultorio" };

async function campos(bytes) {
  const form = (await PDFDocument.load(bytes)).getForm();
  const texto = (nombre) => form.getTextField(nombre).getText() || "";
  const marcada = (nombre) => form.getCheckBox(nombre).isChecked();
  return { texto, marcada };
}

describe("diaPalig", () => {
  it("convierte el día sin pasar por la zona horaria", () => {
    expect(diaPalig("1990-03-05")).toBe("05/03/90");
    expect(diaPalig("")).toBe("");
    expect(diaPalig("5/3/1990")).toBe("");
  });
});

describe("parte del paciente en línea", () => {
  it("llena sus casillas, marca sus opciones, deja editable la parte del profesional y guarda los datos", async () => {
    const pdf = await formularioDelPaciente(await enBlanco(), PACIENTE, PNG);
    const { texto, marcada } = await campos(pdf);
    expect(texto(F.company)).toBe("Empresa Ejemplo S.A.");
    expect(texto(F.policyNumber)).toBe("PL-12345");
    expect(texto(F.birthDate)).toBe("05/03/90");
    expect(texto(F.insuredEmail)).toBe("paciente@example.com");
    expect(marcada("F")).toBe(true);
    expect(marcada("M")).toBe(false);
    expect(marcada("Titular")).toBe(true);
    expect(marcada("Enfermedad")).toBe(true);
    // La parte del profesional sigue vacía.
    expect(texto(F.diagnosis)).toBe("");
    expect(await tipoDePlantillaPalig(pdf)).toBe("editable");
    expect((await leerDatosPalig(pdf)).paciente).toMatchObject({ poliza: "PL-12345", sexo: "F", enLinea: true });
  });

  it("exige lo mínimo y la firma, e ignora opciones que no son del formulario", async () => {
    await expect(formularioDelPaciente(await enBlanco(), { ...PACIENTE, poliza: " " }, PNG)).rejects.toThrow("póliza");
    await expect(formularioDelPaciente(await enBlanco(), PACIENTE, null)).rejects.toThrow("firma");
    const pdf = await formularioDelPaciente(await enBlanco(), { ...PACIENTE, sexo: "X" }, PNG);
    const { marcada } = await campos(pdf);
    expect(marcada("F") || marcada("M")).toBe(false);
  });
});

describe("parte del paciente como foto", () => {
  it("convierte una foto vertical en un formulario escaneado y rechaza una apaisada", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 640]);
    page.drawRectangle({ x: 0, y: 0, width: 400, height: 640 });
    const pdf = await formularioDelPacienteDesdeArchivo(Buffer.from(await doc.save()), "application/pdf");
    expect(await tipoDePlantillaPalig(pdf)).toBe("escaneada");
    await expect(formularioDelPacienteDesdeArchivo(PNG, "image/png")).rejects.toThrow("hoja completa");
  });
});

describe("plantilla con la parte del profesional", () => {
  it("en el editable completa sus casillas y sus datos, sin fechas, y conserva los del paciente", async () => {
    const delPaciente = await formularioDelPaciente(await enBlanco(), PACIENTE, PNG);
    const plantilla = await plantillaConParteProfesional(delPaciente, await enBlanco(), PARTE_PRO, PROFESIONAL);
    const { texto, marcada } = await campos(plantilla);
    expect(texto(F.reason)).toBe("Ansiedad");
    expect(texto(F.diagnosis)).toBe("F41.1");
    expect(texto(F.professionalName)).toBe("Profesional de Prueba");
    expect(texto(F.professionalLicense)).toBe("PSI-1234");
    expect(texto(F.serviceDate)).toBe("");
    expect(texto(F.signatureDate)).toBe("");
    expect(marcada("No")).toBe(true);
    expect(marcada("Consultorio")).toBe(true);
    expect(texto(F.policyNumber)).toBe("PL-12345");
    const datos = await leerDatosPalig(plantilla);
    expect(datos.paciente).toMatchObject({ poliza: "PL-12345" });
    expect(datos.profesional).toMatchObject({ diagnostico: "F41.1", lugar: "consultorio" });
  });

  it("exige motivo y diagnóstico: el sistema no los inventa", async () => {
    const delPaciente = await formularioDelPaciente(await enBlanco(), PACIENTE, PNG);
    await expect(plantillaConParteProfesional(delPaciente, await enBlanco(), { motivo: "Ansiedad" }, PROFESIONAL)).rejects.toThrow("diagnóstico");
  });

  it("sobre una foto escribe la parte del profesional y la guarda para volver a editarla", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([439, 713]);
    const foto = await formularioDelPacienteDesdeArchivo(Buffer.from(await doc.save()), "application/pdf");
    const plantilla = await plantillaConParteProfesional(foto, await enBlanco(), PARTE_PRO, PROFESIONAL);
    expect(await tipoDePlantillaPalig(plantilla)).toBe("escaneada");
    expect((await leerDatosPalig(plantilla)).profesional).toMatchObject({ motivo: "Ansiedad" });
  });
});
