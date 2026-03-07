// src/app/api/upload/professional-invoice/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PROFESSIONAL") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const professionalId = String(session.professionalProfileId || "");
    if (!professionalId) {
      return NextResponse.json({ error: "Perfil profesional no encontrado." }, { status: 403 });
    }

    // Verificar que el profesional estÃ© aprobado
    const profile = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: { isApproved: true },
    });
    if (!profile?.isApproved) {
      return NextResponse.json({ error: "El perfil profesional no esta aprobado." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No se recibiÃ³ ningÃºn archivo." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede pesar mÃ¡s de 5MB." }, { status: 400 });
    }

    const path = `${professionalId}/${uuidv4()}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("professional-invoices")
      .upload(path, buffer, {
        upsert: false,
        contentType: "application/pdf",
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage.from("professional-invoices").getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error("[upload/professional-invoice] Error:", err);
    return NextResponse.json({ error: err.message || "Error inesperado." }, { status: 500 });
  }
}

