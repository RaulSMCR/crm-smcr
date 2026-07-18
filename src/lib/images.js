export const SUPPORTED_PUBLIC_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export const PUBLIC_IMAGE_ACCEPT = SUPPORTED_PUBLIC_IMAGE_TYPES.join(",");

export const IMAGE_FALLBACKS = {
  default: "/images/profesional-hero.webp",
  article: "/images/paciente-hero.webp",
  service: "/images/profesional-hero.webp",
};

const PUBLIC_STORAGE_IMAGE_BUCKETS = new Set(["avatars", "post-covers", "service-banners"]);

function supabasePublicOrigin() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function publicStorageImageUrl(value) {
  const origin = supabasePublicOrigin();
  if (!origin) return "";

  const match = String(value || "").match(/^([^/?#]+)\/(.+)$/);
  if (!match) return "";

  const bucket = match[1];
  const pathWithSuffix = match[2];
  if (!PUBLIC_STORAGE_IMAGE_BUCKETS.has(bucket)) return "";

  const suffixIndex = pathWithSuffix.search(/[?#]/);
  const path = suffixIndex >= 0 ? pathWithSuffix.slice(0, suffixIndex) : pathWithSuffix;
  const suffix = suffixIndex >= 0 ? pathWithSuffix.slice(suffixIndex) : "";
  if (!path || path.startsWith("/") || path.includes("//") || path.includes("..")) return "";

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${origin}/storage/v1/object/public/${bucket}/${encodedPath}${suffix}`;
}

export function normalizeImageSrc(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return fallback ? normalizeImageSrc(fallback) : "";

  const src = raw.replace(/\\/g, "/");
  if (/[<>\u0000-\u001f]/.test(src)) return fallback ? normalizeImageSrc(fallback) : "";

  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return src;
  if (src.startsWith("blob:")) return src;
  if (/^data:image\/(?:avif|gif|jpeg|jpg|png|webp);base64,/i.test(src)) return src;

  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) {
    try {
      const url = new URL(src);
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.toString()
        : fallback
          ? normalizeImageSrc(fallback)
          : "";
    } catch {
      return fallback ? normalizeImageSrc(fallback) : "";
    }
  }

  const storageUrl = publicStorageImageUrl(src);
  if (storageUrl) return storageUrl;

  if (/^(?:brand|images)\//.test(src)) return `/${src}`;

  return fallback ? normalizeImageSrc(fallback) : "";
}
