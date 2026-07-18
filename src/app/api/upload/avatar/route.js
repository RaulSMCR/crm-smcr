// src/app/api/upload/avatar/route.js
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  PUBLIC_IMAGE_MIME_TYPES,
  uploadPublicImage,
  validatePublicImageUpload,
  withImageCacheBust,
} from "@/lib/storage";

const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (session.role !== "PROFESSIONAL" || !session.isApproved) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No se recibio archivo." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen no puede pesar mas de 3 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validatePublicImageUpload(buffer, file.type);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const path = `${session.userId}/avatar.${validation.extension}`;
    const publicUrl = await uploadPublicImage("avatars", path, buffer, {
      contentType: validation.contentType,
      upsert: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: PUBLIC_IMAGE_MIME_TYPES,
    });

    return NextResponse.json({ url: withImageCacheBust(publicUrl) });
  } catch (err) {
    console.error("Error subiendo avatar:", err);
    return NextResponse.json({ error: err.message || "Error inesperado." }, { status: 500 });
  }
}
