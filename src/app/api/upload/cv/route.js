import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const userId = formData.get("userId");

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió el archivo de CV. Adjunte el documento e intente nuevamente." },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "No fue posible completar la carga segura del CV. Recargue la página e intente nuevamente." },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Formato de CV no válido. Se permite PDF o Word." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El CV supera el tamaño máximo permitido de 5 MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${userId}/cv.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from("CVS").upload(path, buffer, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage.from("CVS").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error("Error subiendo CV:", err);
    return NextResponse.json(
      { error: err.message || "No fue posible completar la carga del CV en este momento. Intente nuevamente." },
      { status: 500 }
    );
  }
}
