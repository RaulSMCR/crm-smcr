import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCarouselActor } from "@/lib/carousel-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { uploadPrivate, getSignedUrl, detectFileMimeType } from "@/lib/storage";
import { imageDimensions } from "@/lib/image-size";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const BUCKET = "carousel-images";
const MAX_BYTES = 8 * 1024 * 1024;
const MIN_WIDTH = 1080;
const EXT_BY_MIME = { "image/jpeg": "jpg", "image/png": "png" };
const SIGNED_TTL = 3600;

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonthKeys(n) {
  const keys = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    keys.push(currentMonthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return keys;
}

export async function POST(req) {
  const { res } = await getCarouselActor();
  if (res) return res;

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: "Se esperaba multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ message: "Adjunta una imagen en el campo 'file'." }, { status: 422 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: "La imagen supera el máximo de 8MB." }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectFileMimeType(buffer);
  if (mime !== "image/jpeg" && mime !== "image/png") {
    return NextResponse.json({ message: "Formato no soportado. Usa JPG o PNG." }, { status: 422 });
  }

  const dims = imageDimensions(buffer);
  if (!dims || dims.width < MIN_WIDTH) {
    return NextResponse.json(
      { message: `La imagen debe medir al menos ${MIN_WIDTH}px de ancho (tiene ${dims?.width ?? "desconocido"}).` },
      { status: 422 }
    );
  }

  const pathInBucket = `${currentMonthKey()}/${randomUUID()}.${EXT_BY_MIME[mime]}`;
  try {
    await uploadPrivate(BUCKET, pathInBucket, buffer, mime);
  } catch (err) {
    const msg = String(err?.message || err).toLowerCase();
    if (msg.includes("bucket") && msg.includes("not found")) {
      return NextResponse.json({ message: `El bucket "${BUCKET}" no existe. Créalo (privado) en Supabase.` }, { status: 500 });
    }
    return NextResponse.json({ message: "No se pudo subir la imagen a Storage.", detail: String(err?.message || err) }, { status: 502 });
  }

  let url = null;
  try {
    url = await getSignedUrl(BUCKET, pathInBucket, SIGNED_TTL);
  } catch {
    url = null;
  }

  return NextResponse.json(
    {
      storagePath: pathInBucket,
      specValue: `storage:${BUCKET}/${pathInBucket}`,
      width: dims.width,
      height: dims.height,
      url,
    },
    { status: 201 }
  );
}

export async function GET() {
  const { res } = await getCarouselActor();
  if (res) return res;

  const supabase = getSupabaseAdmin();
  const items = [];

  for (const month of lastMonthKeys(3)) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(month, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error || !data) continue;
    for (const obj of data) {
      // Las "carpetas" no tienen metadata/id; saltarlas.
      if (!obj.name || !obj.id) continue;
      const pathInBucket = `${month}/${obj.name}`;
      items.push({
        storagePath: pathInBucket,
        specValue: `storage:${BUCKET}/${pathInBucket}`,
        createdAt: obj.created_at || obj.updated_at || null,
      });
    }
  }

  items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const capped = items.slice(0, 60);

  const images = await Promise.all(
    capped.map(async (it) => {
      let url = null;
      try {
        url = await getSignedUrl(BUCKET, it.storagePath, SIGNED_TTL);
      } catch {
        url = null;
      }
      return { ...it, url };
    })
  );

  return NextResponse.json({ images });
}
