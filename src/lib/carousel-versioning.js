import crypto from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

export function specHash(spec) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(spec))).digest("hex");
}

export async function nextVersionNumber(tx, carouselId) {
  const latest = await tx.carouselVersion.findFirst({
    where: { carouselId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (latest?.number || 0) + 1;
}

export async function createVersion(tx, {
  carouselId,
  baseVersionId = null,
  spec,
  createdBy,
  comment = null,
  source = "MANUAL_IMPORT",
  assets = [],
  approvalEvents = [],
}) {
  const number = await nextVersionNumber(tx, carouselId);
  const version = await tx.carouselVersion.create({
    data: {
      carouselId,
      number,
      spec,
      specHash: specHash(spec),
      parentVersionId: baseVersionId,
      comment,
      source,
      createdBy,
    },
  });

  if (assets.length) {
    await tx.carouselVersionAsset.createMany({
      data: assets.map((asset) => ({
        versionId: version.id,
        slideId: asset.slideId,
        role: asset.role || "rendered-slide",
        index: asset.index,
        filename: asset.filename,
        storagePath: asset.storagePath,
        mimeType: asset.mimeType || null,
        sha256: asset.sha256 || null,
        note: asset.note || null,
        width: asset.width || 1080,
        height: asset.height || 1080,
      })),
    });
  }

  if (approvalEvents.length) {
    await tx.carouselApprovalEvent.createMany({
      data: approvalEvents.map((event) => ({
        carouselId,
        versionId: version.id,
        slideId: event.slideId,
        status: event.status,
        actorId: createdBy,
        comment: event.comment || null,
      })),
    });
  }

  return version;
}
