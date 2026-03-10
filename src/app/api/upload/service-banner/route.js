import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "El archivo debe ser una imagen." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "La imagen no puede pesar mas de 5 MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeKey = serviceKey.replace(/[^a-zA-Z0-9-_]/g, "");
    const path = `${safeKey}/banner.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from("service-banners").upload(path, buffer, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage.from("service-banners").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error("Error subiendo banner de servicio:", error);
    return NextResponse.json({ error: error.message || "Error inesperado." }, { status: 500 });
  }
}
