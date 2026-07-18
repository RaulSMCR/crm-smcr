import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  PUBLIC_IMAGE_MIME_TYPES,
  uploadPublicImage,
  validatePublicImageUpload,
  withImageCacheBust,
} from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const serviceKey = String(formData.get("serviceKey") || "").trim();

    if (!file) {
      return NextResponse.json({ error: "No se recibio archivo." }, { status: 400 });
    }

    if (!serviceKey) {
      return NextResponse.json({ error: "Falta la referencia del servicio." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen no puede pesar mas de 5 MB." }, { status: 400 });
    }

    const safeKey = serviceKey.replace(/[^a-zA-Z0-9-_]/g, "");
    if (!safeKey) {
      return NextResponse.json({ error: "La referencia del servicio no es valida." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validatePublicImageUpload(buffer, file.type);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const path = `${safeKey}/banner.${validation.extension}`;
    const publicUrl = await uploadPublicImage("service-banners", path, buffer, {
      upsert: true,
      contentType: validation.contentType,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: PUBLIC_IMAGE_MIME_TYPES,
    });

    return NextResponse.json({ url: withImageCacheBust(publicUrl) });
  } catch (error) {
    console.error("Error subiendo banner de servicio:", error);
    return NextResponse.json({ error: error.message || "Error inesperado." }, { status: 500 });
  }
}
