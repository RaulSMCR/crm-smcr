import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const EDITORIAL_PACKAGE_FORMAT = "smcr-editorial-package";
export const EDITORIAL_PACKAGE_SCHEMA_VERSION = 1;

const DOCS_DIR = path.join(process.cwd(), "docs", "gpt-smcr");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function stripHtmlToText(html) {
  return String(html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value || null;
}

function slideIdFor(slide, index, asset) {
  if (slide && typeof slide.slideId === "string" && slide.slideId.trim()) return slide.slideId.trim();
  if (asset?.id) return `slide-${asset.id}`;
  return `slide-${String(index + 1).padStart(2, "0")}`;
}

function normalizeSlide(slide, index, asset) {
  const source = slide && typeof slide === "object" ? slide : {};
  const slideId = slideIdFor(source, index, asset);
  return {
    ...source,
    slideId,
    position: index + 1,
    approvalStatus: source.approvalStatus || "DRAFT",
    assetRefs: Array.isArray(source.assetRefs)
      ? source.assetRefs
      : asset
        ? [{
            assetId: asset.id,
            path: `assets/${asset.filename}`,
            filename: asset.filename,
            mimeType: "image/png",
            role: "rendered-slide",
          }]
        : [],
    ...(asset ? { legacyReady: Boolean(asset.ready), legacyAssetId: asset.id } : {}),
  };
}

function readDoc(filename) {
  try {
    return fs.readFileSync(path.join(DOCS_DIR, filename), "utf8");
  } catch {
    return "";
  }
}

export function articleJson(post) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    content: post.content,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    authorId: post.authorId,
    createdAt: iso(post.createdAt),
    updatedAt: iso(post.updatedAt),
  };
}

export function buildEditorialPackage({ article, carousel, assets = [] }) {
  const sourceSlides = Array.isArray(carousel?.spec?.slides) ? carousel.spec.slides : [];
  const orderedAssets = [...assets].sort((a, b) => Number(a.index) - Number(b.index));
  const slides = sourceSlides.map((slide, index) => normalizeSlide(slide, index, orderedAssets[index]));
  const carouselJson = {
    format: EDITORIAL_PACKAGE_FORMAT,
    schemaVersion: EDITORIAL_PACKAGE_SCHEMA_VERSION,
    mode: "full",
    article: { id: article.id, title: article.title, slug: article.slug },
    carousel: {
      id: carousel?.id || null,
      title: carousel?.title || article.title,
      status: carousel?.status || "DRAFT",
      baseVersionId: null,
      version: null,
      slides,
      legacySpec: carousel?.spec || { title: article.title, slides: [] },
    },
    metadata: {
      source: "crm-manual-export",
      createdAt: new Date().toISOString(),
    },
  };

  const articleText = stripHtmlToText(article.content);
  const articleMarkdown = `# ${article.title}\n\n${articleText}\n`;
  const manifest = {
    format: EDITORIAL_PACKAGE_FORMAT,
    schemaVersion: EDITORIAL_PACKAGE_SCHEMA_VERSION,
    assets: orderedAssets.map((asset, index) => ({
      assetId: asset.id,
      slideId: slides[index]?.slideId || `slide-${String(index + 1).padStart(2, "0")}`,
      filename: asset.filename,
      packagePath: `assets/${asset.filename}`,
      storagePath: asset.storagePath,
      width: asset.width,
      height: asset.height,
      ready: Boolean(asset.ready),
    })),
  };

  const articleJsonText = JSON.stringify(articleJson(article), null, 2);
  const carouselJsonText = JSON.stringify(carouselJson, null, 2);
  const manifestText = JSON.stringify(manifest, null, 2);
  const files = [
    { name: "article.md", data: Buffer.from(articleMarkdown, "utf8") },
    { name: "article.json", data: Buffer.from(articleJsonText, "utf8") },
    { name: "carousel.json", data: Buffer.from(carouselJsonText, "utf8") },
    { name: "brand-context.md", data: Buffer.from(readDoc("01-identidad-y-marca.md"), "utf8") },
    { name: "instructions.md", data: Buffer.from(readDoc("10-instrucciones-gpt.md"), "utf8") },
    { name: "assets-manifest.json", data: Buffer.from(manifestText, "utf8") },
  ];

  return {
    carouselJson,
    manifest,
    files,
    hashes: Object.fromEntries(files.map((file) => [file.name, sha256(file.data)])),
    orderedAssets,
  };
}
