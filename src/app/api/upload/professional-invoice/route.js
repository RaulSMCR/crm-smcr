// src/app/api/upload/professional-invoice/route.js
import { NextResponse } from "next/server";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { fileApiUrl, uploadPrivate, validateFileSignature } from "@/lib/storage";
import { parseSupplierInvoiceXml, SupplierXmlError } from "@/lib/supplier-invoice-xml";

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "PROFESSIONAL") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (isPreviewSession(session)) {
      return NextResponse.json({ error: PREVIEW_BLOCKED_MESSAGE }, { status: 403 });
    }

    const professionalId = String(session.professionalProfileId || "");
    if (!professionalId) {
      return NextResponse.json({ error: "Perfil profesional no encontrado." }, { status: 403 });
    }

    // Verificar que el profesional esté aprobado
    const profile = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: { isApproved: true, userId: true, user: { select: { identification: true } } },
    });
    if (!profile?.isApproved || profile.userId !== String(session.userId || session.sub)) {
      return NextResponse.json({ error: "El perfil profesional no esta aprobado." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    const isPdf = file.type === "application/pdf";
    const isXml = ["application/xml", "text/xml"].includes(file.type) ||
      (["", "application/octet-stream"].includes(file.type) && String(file.name || "").toLowerCase().endsWith(".xml"));
    if (!isPdf && !isXml) {
      return NextResponse.json({ error: "Solo se permiten archivos PDF o XML." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede pesar más de 5MB." }, { status: 400 });
    }

    const extension = isXml ? "xml" : "pdf";
    const path = `${professionalId}/${uuidv4()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const invoiceData = isXml ? parseSupplierInvoiceXml(buffer.toString("utf8"), profile.user?.identification) : null;
    if (!isXml && !validateFileSignature(buffer, ["application/pdf"])) {
      return NextResponse.json({ error: "El contenido del archivo no es un PDF válido." }, { status: 400 });
    }
    await uploadPrivate("professional-invoices", path, buffer, isXml ? "application/xml" : "application/pdf");
    return NextResponse.json({ url: fileApiUrl("professional-invoices", path), path: `professional-invoices/${path}`, invoiceData });
  } catch (err) {
    if (err instanceof SupplierXmlError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[upload/professional-invoice] No se pudo guardar el archivo.");
    return NextResponse.json({ error: "No se pudo guardar el archivo. Inténtelo de nuevo." }, { status: 500 });
  }
}

