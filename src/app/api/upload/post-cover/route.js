import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  PUBLIC_IMAGE_MIME_TYPES,
  uploadPublicImage,
  validatePublicImageUpload,
  withImageCacheBust,
} from "@/lib/storage";

const BUCKET = "post-covers";
const MAX_BYTES = 5 * 1024 * 1024;

async function getUploaderKey(session) {
  if (!session) return null;

  if (session.role === "ADMIN") {
    return `admin/${String(session.sub || session.userId || "unknown")}`;
  }

  if (session.role !== "PROFESSIONAL") return null;

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: String(session.sub || session.userId || "") },
    select: { id: true, isApproved: true },
  });

  if (!profile?.id || !profile.isApproved) return null;
  return profile.id;
}

export async function POST(request) {
  try {
    const session = await getSession();
    const uploaderKey = await getUploaderKey(session);
    if (!uploaderKey) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No se recibio archivo." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen no puede pesar mas de 5 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validatePublicImageUpload(buffer, file.type);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const path = `${uploaderKey}/${crypto.randomUUID()}.${validation.extension}`;
    const publicUrl = await uploadPublicImage(BUCKET, path, buffer, {
      upsert: false,
      contentType: validation.contentType,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: PUBLIC_IMAGE_MIME_TYPES,
    });

    return NextResponse.json({ url: withImageCacheBust(publicUrl) });
  } catch (error) {
    console.error("Error subiendo portada de articulo:", error);
    return NextResponse.json({ error: error.message || "Error inesperado." }, { status: 500 });
  }
}
