// src/lib/palig-plantillas.js
//
// El formulario PALIG de cada paciente, en dos partes (flujo estandarizado del
// 2026-11-03, decisiones de Raúl):
//
//   1. El paciente entrega su parte UNA vez: la llena en línea y firma con el
//      dedo, o sube la foto/PDF del papel firmado. Queda en
//      User.insurancePatientFormUrl.
//   2. Su profesional completa la suya en una pantalla. De ahí sale la
//      plantilla (User.insuranceTemplateUrl + insuranceTemplateProId), la misma
//      que ya usa el piloto: en cada pago se le pone la fecha y la firma.
//
// Si el paciente vuelve a entregar su parte, la plantilla se rearma sola con lo
// que el profesional ya había escrito: el profesional no repite nada.
//
// Los archivos son privados (buckets insurance-patient-forms e
// insurance-templates) y nunca se registran sus datos en los logs.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { esPalig } from "@/lib/palig-policy";
import { WHATSAPP_PHONE } from "@/lib/contact-info";
import { marcarSeguroPalig } from "@/lib/seguro-palig";
import {
  formularioDelPaciente,
  formularioDelPacienteDesdeArchivo,
  leerDatosPalig,
  PaligError,
  plantillaConParteProfesional,
} from "@/lib/palig-pdf";
import { guardarPalig, leerArchivoPalig } from "@/lib/palig-storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseStorageReference } from "@/lib/storage";

const BUCKET_PACIENTE = "insurance-patient-forms";
const BUCKET_PLANTILLA = "insurance-templates";

/** El teléfono de la empresa como se escribe en el formulario: 71291909. */
const TELEFONO_EMPRESA = WHATSAPP_PHONE.replace(/^506/, "");

export function cargarFormularioEnBlanco() {
  return readFile(path.join(process.cwd(), "public/forms/palig-cr-reclamo-2023.pdf"));
}

/** Un archivo del flujo, solo si es del paciente indicado y del bucket esperado. */
export async function descargarDelPaciente(referencia, patientId, bucket) {
  const ref = parseStorageReference(referencia);
  if (!ref || ref.bucket !== bucket || !ref.path.startsWith(`${patientId}/`) || ref.path.includes("..")) {
    throw new PaligError("El formulario no pertenece a este paciente.", 409);
  }
  const { data, error } = await getSupabaseAdmin().storage.from(ref.bucket).download(ref.path);
  if (error || !data) throw new PaligError("No se pudo leer el formulario guardado.", 503);
  return Buffer.from(await data.arrayBuffer());
}

/** Lo que va en la parte fija del profesional: nombre, especialidad, colegiado y el teléfono de la empresa. */
export async function datosFijosDelProfesional(db, professionalId) {
  const perfil = await db.professionalProfile.findUnique({
    where: { id: String(professionalId || "") },
    select: { specialty: true, licenseNumber: true, user: { select: { name: true } } },
  });
  if (!perfil?.user?.name) throw new PaligError("No se encontró el perfil del profesional.", 404);
  return {
    nombre: perfil.user.name,
    especialidad: perfil.specialty || "",
    colegiado: perfil.licenseNumber || "",
    telefono: TELEFONO_EMPRESA,
  };
}

const SELECT_PACIENTE = {
  id: true, role: true, isActive: true, name: true, email: true, phone: true, birthDate: true,
  insuranceName: true, insurancePatientFormUrl: true, insurancePatientFormUploadedAt: true,
  insuranceTemplateUrl: true, insuranceTemplateProId: true,
};

/**
 * En qué punto está el formulario del paciente.
 *   SIN_FORMULARIO      el paciente todavía no entregó su parte
 *   FALTA_PROFESIONAL   la entregó; falta la del profesional
 *   LISTO               hay plantilla: cada pago arma el formulario
 */
export function etapaDelFormulario(paciente) {
  if (paciente.insuranceTemplateUrl) return "LISTO";
  if (paciente.insurancePatientFormUrl) return "FALTA_PROFESIONAL";
  return "SIN_FORMULARIO";
}

/** Para la pantalla del paciente: su etapa, lo que ya llenó y con qué precargar. */
export async function estadoParaElPaciente(db, userId) {
  const paciente = await db.user.findUnique({ where: { id: String(userId) }, select: SELECT_PACIENTE });
  if (!paciente) throw new PaligError("Cuenta no encontrada.", 404);

  let anteriores = null;
  if (paciente.insurancePatientFormUrl) {
    try {
      const pdf = await descargarDelPaciente(paciente.insurancePatientFormUrl, paciente.id, BUCKET_PACIENTE);
      anteriores = (await leerDatosPalig(pdf)).paciente;
    } catch {
      // Un formulario viejo que no se puede leer no impide entregar uno nuevo.
    }
  }

  return {
    esPalig: esPalig(paciente.insuranceName),
    etapa: etapaDelFormulario(paciente),
    entregadoEl: paciente.insurancePatientFormUploadedAt,
    datos: anteriores,
    precarga: {
      nombre: paciente.name || "",
      correo: paciente.email || "",
      telefono: String(paciente.phone || "").replace(/^\+?506/, ""),
      // La fecha de nacimiento es un día de calendario guardado a medianoche UTC.
      nacimiento: paciente.birthDate ? new Date(paciente.birthDate).toISOString().slice(0, 10) : "",
    },
  };
}

/** Rearma la plantilla con la parte del profesional que ya estaba, sobre el formulario nuevo del paciente. */
async function rearmarPlantilla(db, paciente, formularioPaciente) {
  if (!paciente.insuranceTemplateUrl || !paciente.insuranceTemplateProId) return false;
  try {
    const anterior = await descargarDelPaciente(paciente.insuranceTemplateUrl, paciente.id, BUCKET_PLANTILLA);
    const { profesional } = await leerDatosPalig(anterior);
    // Una plantilla armada a mano, antes de este flujo, no trae la parte del
    // profesional en datos: no hay con qué rearmarla y queda como estaba.
    if (!profesional) return false;
    const plantilla = await plantillaConParteProfesional(
      formularioPaciente,
      await cargarFormularioEnBlanco(),
      profesional,
      await datosFijosDelProfesional(db, paciente.insuranceTemplateProId),
    );
    const referencia = await guardarPalig(BUCKET_PLANTILLA, `${paciente.id}/palig-${randomUUID()}.pdf`, plantilla);
    await db.user.update({ where: { id: paciente.id }, data: { insuranceTemplateUrl: referencia, insuranceTemplateUploadedAt: new Date() } });
    return true;
  } catch {
    console.error("[palig-plantillas] TEMPLATE_REBUILD_FAILED");
    return false;
  }
}

/**
 * El paciente entrega su parte.
 *
 * @param {object} entrada
 * @param {"enLinea"|"archivo"} entrada.modo
 * @param {object} [entrada.datos]  en línea: sus datos (ver PALIG_PATIENT_TEXT_FIELDS)
 * @param {File}   [entrada.firma]  en línea: PNG transparente
 * @param {File}   [entrada.archivo] archivo: PDF, JPG o PNG del papel firmado
 * @returns {Promise<{ etapa: string, plantillaRearmada: boolean, paciente: object }>}
 */
export async function guardarParteDelPaciente(db, userId, { modo, datos, firma, archivo }) {
  const paciente = await db.user.findUnique({ where: { id: String(userId) }, select: SELECT_PACIENTE });
  if (!paciente || paciente.role !== "USER" || !paciente.isActive) throw new PaligError("Cuenta no disponible.", 403);

  let formulario;
  if (modo === "enLinea") {
    const { bytes, mime } = await leerArchivoPalig(firma, { proof: true });
    if (mime !== "image/png") throw new PaligError("La firma tiene que llegar como imagen PNG.");
    formulario = await formularioDelPaciente(await cargarFormularioEnBlanco(), datos, bytes);
  } else if (modo === "archivo") {
    const { bytes, mime } = await leerArchivoPalig(archivo, { proof: true });
    formulario = await formularioDelPacienteDesdeArchivo(bytes, mime);
  } else {
    throw new PaligError("Elija cómo entrega el formulario.");
  }

  const referencia = await guardarPalig(BUCKET_PACIENTE, `${paciente.id}/palig-${randomUUID()}.pdf`, formulario);
  await db.user.update({
    where: { id: paciente.id },
    data: { insurancePatientFormUrl: referencia, insurancePatientFormUploadedAt: new Date() },
  });
  // Quien entrega el formulario de PALIG tiene PALIG: no hace falta que lo
  // declare aparte en su perfil.
  if (!esPalig(paciente.insuranceName)) await marcarSeguroPalig(db, paciente.id);

  const plantillaRearmada = await rearmarPlantilla(db, paciente, formulario);
  const actualizado = { ...paciente, insurancePatientFormUrl: referencia };
  return { etapa: etapaDelFormulario(actualizado), plantillaRearmada, paciente: actualizado };
}

/** Para la pantalla del profesional: la etapa y lo que ya escribió, si hay. */
export async function estadoParaElProfesional(db, patientId) {
  const paciente = await db.user.findUnique({ where: { id: String(patientId) }, select: SELECT_PACIENTE });
  if (!paciente) throw new PaligError("Paciente no encontrado.", 404);

  let tipo = null;
  let parteProfesional = null;
  let partePaciente = null;
  if (paciente.insurancePatientFormUrl) {
    try {
      const pdf = await descargarDelPaciente(paciente.insurancePatientFormUrl, paciente.id, BUCKET_PACIENTE);
      ({ tipo, paciente: partePaciente } = await leerDatosPalig(pdf));
    } catch {
      tipo = null;
    }
  }
  if (paciente.insuranceTemplateUrl) {
    try {
      const pdf = await descargarDelPaciente(paciente.insuranceTemplateUrl, paciente.id, BUCKET_PLANTILLA);
      parteProfesional = (await leerDatosPalig(pdf)).profesional;
    } catch {
      parteProfesional = null;
    }
  }
  return {
    nombre: paciente.name,
    esPalig: esPalig(paciente.insuranceName),
    etapa: etapaDelFormulario(paciente),
    tipo,
    partePaciente,
    parteProfesional,
    // Quién armó la plantilla vigente: la pantalla avisa antes de reemplazar la de otro.
    plantillaProId: paciente.insuranceTemplateUrl ? paciente.insuranceTemplateProId : null,
  };
}

/** El profesional completa su parte: se arma y se guarda la plantilla del paciente. */
export async function guardarParteDelProfesional(db, { patientId, professionalId, datos }) {
  const paciente = await db.user.findUnique({ where: { id: String(patientId) }, select: SELECT_PACIENTE });
  if (!paciente) throw new PaligError("Paciente no encontrado.", 404);
  if (!paciente.insurancePatientFormUrl) {
    throw new PaligError("El paciente todavía no entregó su parte del formulario.", 409);
  }

  const formularioPaciente = await descargarDelPaciente(paciente.insurancePatientFormUrl, paciente.id, BUCKET_PACIENTE);
  const plantilla = await plantillaConParteProfesional(
    formularioPaciente,
    await cargarFormularioEnBlanco(),
    datos,
    await datosFijosDelProfesional(db, professionalId),
  );
  const referencia = await guardarPalig(BUCKET_PLANTILLA, `${paciente.id}/palig-${randomUUID()}.pdf`, plantilla);
  await db.user.update({
    where: { id: paciente.id },
    data: { insuranceTemplateUrl: referencia, insuranceTemplateUploadedAt: new Date(), insuranceTemplateProId: String(professionalId) },
  });
  return { ok: true };
}

/** Los profesionales del paciente (por citas o por caso), con su correo, para avisarles. */
export async function profesionalesDelPaciente(db, patientId) {
  const id = String(patientId);
  return db.professionalProfile.findMany({
    where: {
      isApproved: true,
      OR: [{ appointments: { some: { patientId: id } } }, { casos: { some: { patientId: id } } }],
    },
    select: { id: true, user: { select: { email: true, name: true } } },
  });
}
