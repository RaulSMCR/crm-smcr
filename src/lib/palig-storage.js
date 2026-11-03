import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseStorageReference, detectFileMimeType } from "@/lib/storage";
import { PaligError } from "@/lib/palig-pdf";

// Debajo del límite de cuerpo de las funciones Vercel, incluyendo multipart.
export const PALIG_FILE_LIMIT = 4 * 1024 * 1024;

export async function leerArchivoPalig(file, { proof = false } = {}) {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) throw new PaligError("Seleccione el archivo.");
  if (file.size > PALIG_FILE_LIMIT) throw new PaligError("El archivo no puede superar 4 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = detectFileMimeType(bytes);
  const allowed = proof ? ["application/pdf", "image/jpeg", "image/png"] : ["application/pdf"];
  if (!allowed.includes(mime) || file.type && file.type !== mime) throw new PaligError(proof ? "El comprobante debe ser un PDF, JPG o PNG válido." : "La plantilla debe ser un PDF válido.");
  try {
    if (mime === "application/pdf") {
      const doc = await PDFDocument.load(bytes);
      if (!doc.getPageCount()) throw new Error();
    } else {
      const doc = await PDFDocument.create();
      if (mime === "image/png") await doc.embedPng(bytes); else await doc.embedJpg(bytes);
    }
  } catch { throw new PaligError("El archivo está dañado o protegido. Seleccione el original."); }
  return { bytes, mime, extension: { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" }[mime] };
}

export async function descargarPlantillaPalig(reference, patientId) {
  const ref = parseStorageReference(reference);
  if (!ref || ref.bucket !== "insurance-templates" || !ref.path.startsWith(`${patientId}/`)) throw new PaligError("La plantilla no pertenece a este paciente.", 409);
  const { data, error } = await getSupabaseAdmin().storage.from(ref.bucket).download(ref.path);
  if (error || !data || data.size > PALIG_FILE_LIMIT) throw new PaligError("No se pudo leer la plantilla. Vuelva a guardarla.", 409);
  return Buffer.from(await data.arrayBuffer());
}

/** Una copia privada del trámite: solo las de su carpeta {claimId}/palig/. */
export async function descargarDelTramite(reference, claimId) {
  const ref = parseStorageReference(reference);
  if (!ref || ref.bucket !== "insurance-signed-forms" || !ref.path.startsWith(`${claimId}/palig/`)) throw new PaligError("Documento no disponible.", 404);
  const { data, error } = await getSupabaseAdmin().storage.from(ref.bucket).download(ref.path);
  if (error || !data) throw new PaligError("No se pudo leer el documento del trámite.", 503);
  return Buffer.from(await data.arrayBuffer());
}

// Las firmas de cada profesional: PNG transparentes, privados, en
// firmas/<slug>/firma-1.png, firma-2.png… Rotan: cada formulario lleva una
// distinta. /api/files no las entrega a nadie; se leen acá al firmar, y solo su
// dueño las ve en su pantalla de firmas (/api/pro/firmas).
const BUCKET_FIRMAS = "insurance-templates";

/** Cuántas versiones puede tener guardadas un profesional. */
export const MAXIMO_DE_FIRMAS = 10;

/** Una firma no necesita más: es un trazo sobre fondo transparente. */
export const LIMITE_DE_FIRMA = 1024 * 1024;

/** La carpeta de las firmas de un profesional. El slug arma una ruta: se valida. */
export function carpetaDeFirmas(slug) {
  const limpio = String(slug || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(limpio)) throw new PaligError("Profesional inválido.", 400);
  return `firmas/${limpio}`;
}

/** Números de las versiones de la firma que hay guardadas, de menor a mayor. */
export async function versionesDeFirma(slug) {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET_FIRMAS).list(carpetaDeFirmas(slug), { limit: 100 });
  if (error) throw new PaligError("No se pudieron leer las firmas guardadas.", 503);
  return (data || []).map((f) => /^firma-(\d+)\.png$/.exec(f.name)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
}

export async function descargarFirma(slug, version) {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET_FIRMAS).download(`${carpetaDeFirmas(slug)}/firma-${Number(version)}.png`);
  if (error || !data) throw new PaligError("No se pudo leer la firma guardada.", 503);
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Guarda una firma nueva con el número que sigue. Nunca pisa una versión: un
 * formulario ya firmado anota qué versión usó, y moverle la firma tiene que
 * volver a encontrar la misma.
 */
export async function guardarFirma(slug, bytes) {
  if (!bytes?.length || bytes.length > LIMITE_DE_FIRMA) throw new PaligError("La firma no puede superar 1 MB.");
  if (detectFileMimeType(bytes) !== "image/png") throw new PaligError("La firma tiene que ser una imagen PNG.");
  try {
    await (await PDFDocument.create()).embedPng(bytes);
  } catch { throw new PaligError("La imagen de la firma está dañada."); }

  const versiones = await versionesDeFirma(slug);
  if (versiones.length >= MAXIMO_DE_FIRMAS) throw new PaligError(`Puede guardar hasta ${MAXIMO_DE_FIRMAS} firmas. Borre alguna primero.`, 409);
  const version = (versiones.at(-1) || 0) + 1;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET_FIRMAS)
    .upload(`${carpetaDeFirmas(slug)}/firma-${version}.png`, bytes, { contentType: "image/png", upsert: false, cacheControl: "0" });
  if (error) throw new PaligError("No se pudo guardar la firma. Intente de nuevo.", 503);
  return version;
}

export async function borrarFirma(slug, version) {
  const { error } = await getSupabaseAdmin().storage.from(BUCKET_FIRMAS).remove([`${carpetaDeFirmas(slug)}/firma-${Number(version)}.png`]);
  if (error) throw new PaligError("No se pudo borrar la firma.", 503);
}

/**
 * Nombre del archivo de la plantilla. Una escaneada lleva la marca en el
 * nombre: así la pantalla sabe ofrecer el ajuste de la fecha sin abrir el PDF.
 */
export function nombreDePlantilla(patientId, tipo) {
  return `${patientId}/palig-${tipo === "escaneada" ? "escaneada-" : ""}${randomUUID()}.pdf`;
}

export async function guardarPalig(bucket, path, bytes, contentType = "application/pdf") {
  const { error } = await getSupabaseAdmin().storage.from(bucket).upload(path, bytes, { contentType, upsert: false, cacheControl: "0" });
  if (error) throw new PaligError("No se pudo guardar el documento privado. No se registró el pago.", 503);
  return `${bucket}/${path}`;
}
