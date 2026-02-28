// src/app/api/upload/avatar/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    // 1) Verificar sesión
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    // 2) Solo profesionales aprobados
    if (session.role !== "PROFESSIONAL" || !session.isApproved) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    // 3) Obtener archivo
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo." }, { status: 400 });
    }

    // 4) Validaciones
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "El archivo debe ser una imagen." }, { status: 400 });
    }
    if (file.size > 3 * 1024 * 1024) {
      return NextResponse.json({ error: "La imagen no puede pesar más de 3MB." }, { status: 400 });
    }

    // 5) Subir a Supabase con service_role
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${session.userId}/avatar.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    // 6) Obtener URL pública
    const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error("Error subiendo avatar:", err);
    return NextResponse.json({ error: err.message || "Error inesperado." }, { status: 500 });
  }
}