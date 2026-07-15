import { NextResponse } from "next/server";
import {
  buildPendingCvPath,
  CV_ALLOWED_MIME_TYPES,
  CV_MAX_BYTES,
  CV_UPLOAD_BUCKET,
  normalizeCvUploadId,
} from "@/lib/cv-upload";
import { checkRateLimit } from "@/lib/rate-limit";
import { fileApiUrl, uploadPrivate, validateFileSignature } from "@/lib/storage";

function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimit(`upload-cv:${ip}`, { max: 10, windowMinutes: 60 });
    if (rl.limited) {
      return NextResponse.json(
        { error: "Demasiados intentos de carga. Espere unos minutos e intente nuevamente." },
        { status: 429, headers: { "Retry-After": String((rl.retryAfterMinutes || 60) * 60) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const uploadId = normalizeCvUploadId(formData.get("uploadId"));

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "No se recibio el archivo de CV. Adjunte el documento e intente nuevamente." },
        { status: 400 }
      );
    }

    if (!uploadId) {
      return NextResponse.json(
        { error: "No fue posible completar la carga segura del CV. Recargue la pagina e intente nuevamente." },
        { status: 400 }
      );
    }

    if (!CV_ALLOWED_MIME_TYPES[file.type]) {
      return NextResponse.json({ error: "Formato de CV no valido. Se permite PDF o Word." }, { status: 400 });
    }

    if (file.size > CV_MAX_BYTES) {
      return NextResponse.json({ error: "El CV supera el tamano maximo permitido de 5 MB." }, { status: 400 });
    }

    const path = buildPendingCvPath(uploadId, file.type);
    if (!path) {
      return NextResponse.json(
        { error: "No fue posible completar la carga segura del CV. Recargue la pagina e intente nuevamente." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateFileSignature(buffer, [file.type])) {
      return NextResponse.json({ error: "El contenido no coincide con el formato declarado." }, { status: 400 });
    }
    await uploadPrivate(CV_UPLOAD_BUCKET, path, buffer, file.type);
    return NextResponse.json({ url: fileApiUrl(CV_UPLOAD_BUCKET, path), path: `${CV_UPLOAD_BUCKET}/${path}` });
  } catch (err) {
    console.error("Error subiendo CV:", err);
    return NextResponse.json(
      { error: err.message || "No fue posible completar la carga del CV en este momento. Intente nuevamente." },
      { status: 500 }
    );
  }
}
