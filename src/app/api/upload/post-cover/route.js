import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const BUCKET = "post-covers";
const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function getApprovedProfessionalId(session) {
  if (!session || session.role !== "PROFESSIONAL") return null;

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
    const professionalId = await getApprovedProfessionalId(session);
    if (!professionalId) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No se recibio archivo." }, { status: 400 });
    }

    if (!file.type?.startsWith("image/")) {
      return NextResponse.json({ error: "El archivo debe ser una imagen." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen no puede pesar mas de 5 MB." }, { status: 400 });
    }

    const ext = EXTENSION_BY_TYPE[file.type] || file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${professionalId}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabaseAdmin = getSupabaseAdmin();
    const uploadOptions = {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    };

    let { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, uploadOptions);

    if (uploadError?.message?.toLowerCase().includes("bucket not found")) {
      const { error: bucketError } = await supabaseAdmin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: Object.keys(EXTENSION_BY_TYPE),
      });

      if (bucketError && !bucketError.message?.toLowerCase().includes("already exists")) {
        throw bucketError;
      }

      const retry = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, uploadOptions);
      uploadError = retry.error;
    }

    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error("Error subiendo portada de articulo:", error);
    return NextResponse.json({ error: error.message || "Error inesperado." }, { status: 500 });
  }
}
