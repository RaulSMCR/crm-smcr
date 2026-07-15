import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

export function validateFileSignature(buffer, allowedTypes) {
  const bytes = Buffer.from(buffer || []);
  const types = new Set(allowedTypes || []);
  const isPdf = bytes.subarray(0, 4).toString("ascii") === "%PDF";
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const isLegacyWord = bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  const isOpenXml = bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  return (isPdf && types.has("application/pdf")) ||
    (isJpeg && types.has("image/jpeg")) ||
    (isPng && types.has("image/png")) ||
    (isWebp && types.has("image/webp")) ||
    (isLegacyWord && types.has("application/msword")) ||
    (isOpenXml && types.has("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
}
