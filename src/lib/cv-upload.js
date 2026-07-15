export const CV_UPLOAD_BUCKET = "CVS";
export const CV_PENDING_PREFIX = "professional-registration";
export const CV_MAX_BYTES = 5 * 1024 * 1024;

export const CV_ALLOWED_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PENDING_CV_PATH_RE = new RegExp(
  `^${CV_PENDING_PREFIX}/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/cv\\.(pdf|doc|docx)$`,
  "i"
);

export function normalizeCvUploadId(value) {
  const uploadId = String(value || "").trim().toLowerCase();
  return UUID_V4_RE.test(uploadId) ? uploadId : null;
}

export function getCvExtensionForMimeType(mimeType) {
  return CV_ALLOWED_MIME_TYPES[String(mimeType || "")] || null;
}

export function buildPendingCvPath(uploadId, mimeType) {
  const normalizedUploadId = normalizeCvUploadId(uploadId);
  const ext = getCvExtensionForMimeType(mimeType);

  if (!normalizedUploadId || !ext) return null;
  return `${CV_PENDING_PREFIX}/${normalizedUploadId}/cv.${ext}`;
}

export function getCvStoragePathFromPublicUrl(url, expectedSupabaseUrl = null) {
  const raw = String(url || "").trim();
  if (raw.startsWith(`${CV_UPLOAD_BUCKET}/`)) return raw.slice(CV_UPLOAD_BUCKET.length + 1);
  try {
    const parsed = new URL(raw, "http://localhost");
    if (parsed.pathname === "/api/files") {
      const reference = parsed.searchParams.get("path") || "";
      return reference.startsWith(`${CV_UPLOAD_BUCKET}/`) ? reference.slice(CV_UPLOAD_BUCKET.length + 1) : null;
    }
    if (expectedSupabaseUrl) {
      const expected = new URL(String(expectedSupabaseUrl));
      if (parsed.origin !== expected.origin) return null;
    }

    const marker = `/storage/v1/object/public/${CV_UPLOAD_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);

    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.substring(idx + marker.length));
  } catch {
    return null;
  }
}

export function isPendingCvPath(path) {
  return PENDING_CV_PATH_RE.test(String(path || ""));
}

export function getExtensionFromPendingCvPath(path) {
  const match = String(path || "").match(PENDING_CV_PATH_RE);
  return match ? match[2].toLowerCase() : null;
}
