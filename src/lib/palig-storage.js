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

// Las firmas de Raúl: PNG transparentes, privados, firma-1.png, firma-2.png…
// /api/files no las entrega a nadie; solo se leen acá, al firmar.
export const CARPETA_FIRMAS = "firmas/raul-olmedo";

/** Números de las versiones de la firma que hay guardadas, de menor a mayor. */
export async function versionesDeFirma() {
  const { data, error } = await getSupabaseAdmin().storage.from("insurance-templates").list(CARPETA_FIRMAS, { limit: 100 });
  if (error) throw new PaligError("No se pudieron leer las firmas guardadas.", 503);
  return (data || []).map((f) => /^firma-(\d+)\.png$/.exec(f.name)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
}

export async function descargarFirma(version) {
  const { data, error } = await getSupabaseAdmin().storage.from("insurance-templates").download(`${CARPETA_FIRMAS}/firma-${version}.png`);
  if (error || !data) throw new PaligError("No se pudo leer la firma guardada.", 503);
  return Buffer.from(await data.arrayBuffer());
}

export async function guardarPalig(bucket, path, bytes, contentType = "application/pdf") {
  const { error } = await getSupabaseAdmin().storage.from(bucket).upload(path, bytes, { contentType, upsert: false, cacheControl: "0" });
  if (error) throw new PaligError("No se pudo guardar el documento privado. No se registró el pago.", 503);
  return `${bucket}/${path}`;
}
