import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeExtFromMime(mime) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPG, PNG o WEBP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen excede 3MB." },
        { status: 400 }
      );
    }

    const ext = safeExtFromMime(file.type);
    if (!ext) {
      return NextResponse.json({ error: "Extensión inválida" }, { status: 400 });
    }

    const userId = session.user.id;
    const path = `${userId}/avatar.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (upErr) {
      return NextResponse.json(
        { error: `Storage upload: ${upErr.message}` },
        { status: 400 }
      );
    }

    const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json(
        { error: "No se pudo obtener URL pública." },
        { status: 500 }
      );
    }

    // ✅ Guarda en DB (elige UNA de estas dos opciones)

    // Opción A (recomendada): en User.image
    await prisma.user.update({
      where: { id: userId },
      data: { image: publicUrl },
    });

    // Opción B: si lo guardas en ProfessionalProfile.avatarUrl:
    // await prisma.professionalProfile.update({
    //   where: { userId },
    //   data: { avatarUrl: publicUrl },
    // });

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado (server)" },
      { status: 500 }
    );
  }
}