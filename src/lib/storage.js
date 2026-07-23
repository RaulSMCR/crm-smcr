import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SUPPORTED_PUBLIC_IMAGE_TYPES } from "@/lib/images";

export const PUBLIC_IMAGE_MIME_TYPES = SUPPORTED_PUBLIC_IMAGE_TYPES;

export const IMAGE_EXTENSION_BY_MIME_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

// Las columnas de documentos privados guardan `bucket/path`, nunca una URL pública.
export function storageReference(bucket, path) {
  return `${bucket}/${path}`;
}

export function parseStorageReference(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("\\") || raw.includes("..")) return null;
  const match = raw.match(/^([^/]+)\/(.+)$/);
  if (!match || !match[2] || match[2].startsWith("/") || match[2].includes("//")) return null;
  return { bucket: match[1], path: match[2] };
}

export function fileApiUrl(bucket, path) {
  return `/api/files?path=${encodeURIComponent(storageReference(bucket, path))}`;
}

export async function uploadPrivate(bucket, path, buffer, contentType) {
  const { error } = await getSupabaseAdmin().storage.from(bucket).upload(path, buffer, {
    upsert: true,
    contentType,
    cacheControl: "3600",
  });
  if (error) throw error;
  return storageReference(bucket, path);
}

export async function getSignedUrl(bucket, path, expiresInSeconds = 900) {
  const { data, error } = await getSupabaseAdmin().storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export function detectFileMimeType(buffer) {
  const bytes = Buffer.from(buffer || []);
  const isPdf = bytes.subarray(0, 4).toString("ascii") === "%PDF";
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const gifHeader = bytes.subarray(0, 6).toString("ascii");
  const isGif = gifHeader === "GIF87a" || gifHeader === "GIF89a";
  const brand = bytes.subarray(8, 12).toString("ascii");
  const isAvif = bytes.subarray(4, 8).toString("ascii") === "ftyp" && (brand === "avif" || brand === "avis");
  const isLegacyWord = bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  const isOpenXml = bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

  if (isPdf) return "application/pdf";
  if (isJpeg) return "image/jpeg";
  if (isPng) return "image/png";
  if (isWebp) return "image/webp";
  if (isGif) return "image/gif";
  if (isAvif) return "image/avif";
  if (isLegacyWord) return "application/msword";
  if (isOpenXml) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "";
}

export function validateFileSignature(buffer, allowedTypes) {
  const types = new Set(allowedTypes || []);
  return types.has(detectFileMimeType(buffer));
}

function normalizeDeclaredMimeType(value) {
  const type = String(value || "").toLowerCase().trim();
  if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
  if (type === "image/x-png") return "image/png";
  return type;
}

export function validatePublicImageUpload(buffer, declaredType = "") {
  const allowed = new Set(PUBLIC_IMAGE_MIME_TYPES);
  const detectedType = detectFileMimeType(buffer);
  const cleanDeclaredType = normalizeDeclaredMimeType(declaredType);

  if (!allowed.has(detectedType)) {
    return {
      ok: false,
      error: "Formato no soportado. Usa JPG, PNG, WEBP, GIF o AVIF.",
    };
  }

  if (cleanDeclaredType && cleanDeclaredType !== detectedType) {
    return {
      ok: false,
      error: "El contenido no coincide con el tipo de imagen indicado.",
    };
  }

  return {
    ok: true,
    contentType: detectedType,
    extension: IMAGE_EXTENSION_BY_MIME_TYPE[detectedType] || "jpg",
  };
}

function isBucketNotFound(error) {
  return String(error?.message || "").toLowerCase().includes("bucket not found");
}

// Garantiza que el bucket exista Y sea público. Es idempotente y se llama antes
// de cada subida pública.
//
// El bug que corrige: la versión anterior solo pasaba `public: true` al CREAR el
// bucket. Si el bucket ya existía en privado, la subida igual tenía éxito (subir
// funciona en buckets privados), pero la URL pública devolvía 400 "Bucket not
// found" y toda imagen caía al mismo fallback local — todos los artículos con la
// misma portada equivocada. Al volver público un bucket, sus objetos ya subidos
// también pasan a ser accesibles, de modo que esto recupera las portadas
// existentes además de arreglar las nuevas.
async function ensurePublicBucket(bucket, { fileSizeLimit, allowedMimeTypes } = {}) {
  const supabaseAdmin = getSupabaseAdmin();
  const options = {
    public: true,
    ...(fileSizeLimit ? { fileSizeLimit } : {}),
    ...(allowedMimeTypes ? { allowedMimeTypes } : {}),
  };

  const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucket, options);
  if (!updateError) return;

  // No existe todavía: crearlo público. Cualquier otro error (permisos, red) se
  // propaga para no enmascarar un fallo real de subida.
  if (isBucketNotFound(updateError)) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(bucket, options);
    if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
      throw createError;
    }
    return;
  }

  throw updateError;
}

export async function uploadPublicImage(bucket, path, buffer, {
  contentType,
  upsert = true,
  cacheControl = "3600",
  fileSizeLimit,
  allowedMimeTypes = PUBLIC_IMAGE_MIME_TYPES,
} = {}) {
  const supabaseAdmin = getSupabaseAdmin();
  const uploadOptions = { upsert, contentType, cacheControl };

  // Antes de subir, asegura que el bucket exista y sea PÚBLICO. Sin esto, un
  // bucket privado preexistente aceptaba la subida pero servía 400 en la URL
  // pública (ver ensurePublicBucket).
  await ensurePublicBucket(bucket, { fileSizeLimit, allowedMimeTypes });

  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, uploadOptions);
  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function withImageCacheBust(url, version = Date.now()) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("v", String(version));
    return parsed.toString();
  } catch {
    return url;
  }
}
