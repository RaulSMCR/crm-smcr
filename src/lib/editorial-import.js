import crypto from "node:crypto";
import { z } from "zod";
import { detectFileMimeType } from "@/lib/storage";
import { imageDimensions } from "@/lib/image-size";

const supportedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const assetRefSchema = z.object({
  assetId: z.string().optional(),
  path: z.string().min(1),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  sha256: z.string().optional(),
  role: z.string().optional(),
}).passthrough();

const slideSchema = z.object({
  slideId: z.string().trim().min(1),
  position: z.number().int().positive(),
  type: z.string().trim().min(1),
  approvalStatus: z.enum(["DRAFT", "APPROVED", "REJECTED"]).default("DRAFT"),
  assetRefs: z.array(assetRefSchema).default([]),
}).passthrough();

const envelopeSchema = z.object({
  format: z.literal("smcr-editorial-package"),
  schemaVersion: z.literal(1),
  mode: z.enum(["full", "partial"]),
  article: z.object({ id: z.string().optional() }).passthrough().optional(),
  carousel: z.object({
    id: z.string().nullable().optional(),
    title: z.string().min(1),
    baseVersionId: z.string().nullable().optional(),
    version: z.number().int().positive().nullable().optional(),
    slides: z.array(slideSchema).optional(),
    legacySpec: z.record(z.string(), z.unknown()).optional(),
  }).passthrough().optional(),
  changes: z.array(z.object({
    slideId: z.string().trim().min(1),
    operation: z.enum(["replace", "add", "remove"]),
    position: z.number().int().positive().optional(),
    slide: slideSchema.optional(),
  }).passthrough()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function basename(value) {
  return String(value || "").split(/[\\/]/).pop();
}

export function normalizeImportedPackage(value) {
  const candidate = value && value.format === "smcr-editorial-package"
    ? value
    : {
        format: "smcr-editorial-package",
        schemaVersion: 1,
        mode: "full",
        carousel: value,
        metadata: { source: "legacy-carousel-spec" },
      };
  const parsed = envelopeSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      data: null,
    };
  }
  return { ok: true, errors: [], data: parsed.data };
}

function slideMap(slides = []) {
  return new Map(slides.map((slide) => [slide.slideId, slide]));
}

export function normalizeCurrentSlides(spec, assets = []) {
  const sourceSlides = Array.isArray(spec?.slides) ? spec.slides : [];
  const orderedAssets = [...assets].sort((a, b) => Number(a.index) - Number(b.index));
  return sourceSlides.map((slide, index) => {
    const asset = orderedAssets[index];
    return {
      ...slide,
      slideId: slide.slideId || (asset?.id ? `slide-${asset.id}` : `slide-${String(index + 1).padStart(2, "0")}`),
      position: slide.position || index + 1,
      approvalStatus: slide.approvalStatus || "DRAFT",
      assetRefs: Array.isArray(slide.assetRefs)
        ? slide.assetRefs
        : asset
          ? [{ assetId: asset.id, path: `assets/${asset.filename}`, filename: asset.filename, role: "rendered-slide" }]
          : [],
    };
  });
}

export function applyImportToSlides(currentSlides, imported) {
  const base = Array.isArray(currentSlides) ? currentSlides.map((slide, index) => ({
    ...slide,
    slideId: slide.slideId || `slide-${String(index + 1).padStart(2, "0")}`,
    position: slide.position || index + 1,
  })) : [];

  if (imported.mode === "full") {
    return imported.carousel?.slides || [];
  }

  const result = [...base];
  const indexById = new Map(result.map((slide, index) => [slide.slideId, index]));
  for (const change of imported.changes || []) {
    const currentIndex = indexById.get(change.slideId);
    if (change.operation === "remove") {
      if (currentIndex !== undefined) result.splice(currentIndex, 1);
      continue;
    }
    if (!change.slide) continue;
    if (currentIndex === undefined) result.push(change.slide);
    else result[currentIndex] = change.slide;
  }
  return result.map((slide, index) => ({ ...slide, position: slide.position || index + 1 }));
}

export function compareSlides(currentSlides, importedSlides) {
  const current = slideMap(currentSlides);
  const incoming = slideMap(importedSlides);
  const ids = new Set([...current.keys(), ...incoming.keys()]);
  const changes = [];

  for (const slideId of ids) {
    const before = current.get(slideId);
    const after = incoming.get(slideId);
    if (!before) {
      changes.push({ slideId, kind: "new", textChanged: true, assetChanged: Boolean(after?.assetRefs?.length), orderChanged: true });
      continue;
    }
    if (!after) {
      changes.push({ slideId, kind: "deleted", textChanged: false, assetChanged: false, orderChanged: true });
      continue;
    }

    const beforeAssets = before.assetRefs || [];
    const afterAssets = after.assetRefs || [];
    const textChanged = digest({ ...before, assetRefs: undefined, approvalStatus: undefined }) !==
      digest({ ...after, assetRefs: undefined, approvalStatus: undefined });
    const assetChanged = digest(beforeAssets) !== digest(afterAssets);
    const orderChanged = before.position !== after.position;
    const approvalChanged = before.approvalStatus !== after.approvalStatus;
    if (textChanged || assetChanged || orderChanged || approvalChanged) {
      changes.push({ slideId, kind: "modified", textChanged, assetChanged, orderChanged, approvalChanged });
    }
  }

  return changes;
}

export async function inspectImportFiles(files) {
  const fileMap = new Map();
  const errors = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectFileMimeType(buffer);
    if (!supportedTypes.has(detected)) {
      errors.push({ file: file.name, message: "Formato no soportado. Usa PNG, JPG o WebP." });
      continue;
    }
    if (buffer.length > 8 * 1024 * 1024) {
      errors.push({ file: file.name, message: "La imagen supera el máximo de 8MB." });
      continue;
    }
    const dimensions = imageDimensions(buffer);
    fileMap.set(file.name, {
      name: file.name,
      mimeType: detected,
      size: buffer.length,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      width: dimensions?.width || null,
      height: dimensions?.height || null,
    });
  }
  return { files: [...fileMap.values()], errors };
}

export function filesForSlides(slides, fileMeta) {
  const byName = new Map(fileMeta.map((file) => [file.name, file]));
  return slides.map((slide) => ({
    slideId: slide.slideId,
    assets: (slide.assetRefs || []).map((ref) => {
      const name = ref.filename || basename(ref.path);
      return { ...ref, file: byName.get(name) || null };
    }),
  }));
}
