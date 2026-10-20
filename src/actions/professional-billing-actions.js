"use server";

// src/actions/professional-billing-actions.js
import { prisma } from "@/lib/prisma";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { professionalInvoiceFile, readProfessionalInvoiceXml } from "@/lib/supplier-invoice-files";
import { SupplierXmlError } from "@/lib/supplier-invoice-xml";
import {
  firstIssueMessage,
  professionalInvoiceSchema,
  supplierAcceptanceSchema,
} from "@/lib/financial-schemas";

async function requireApprovedProfessional() {
  const session = await getSession();
  if (!session || session.role !== "PROFESSIONAL") {
    return { error: "No autorizado." };
  }
  if (isPreviewSession(session)) {
    return { error: PREVIEW_BLOCKED_MESSAGE };
  }
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: String(session.userId || session.sub) },
    // `commission` no se selecciona: es un campo legado del esquema de comisión
    // fija por profesional y ningún cálculo lo lee. Traerlo invitaba a creer que
    // el 10% por defecto era la comisión pactada. Ver el anexo económico.
    select: { id: true, userId: true, isApproved: true, user: { select: { identification: true } } },
  });
  if (!profile) return { error: "Perfil profesional no encontrado." };
  if (!profile.isApproved) return { error: "El perfil profesional aún no ha sido aprobado." };
  return { profile };
}

/**
 * Presenta una factura semanal del profesional a la plataforma.
 * Crea una SUPPLIER_INVOICE en estado DRAFT para que el admin la valide y pague.
 */
export async function submitProfessionalInvoice({
  fileUrl,
  xmlUrl,
  periodStart,
  periodEnd,
  settlementId,
}) {
  try {
    const auth = await requireApprovedProfessional();
    if (auth.error) return { success: false, error: auth.error };
    const { profile } = auth;

    professionalInvoiceFile(fileUrl, profile.id, "pdf");
    // Se vuelve a leer el archivo privado: los valores enviados por el navegador
    // nunca pueden reemplazar los datos del comprobante que quedará adjunto.
    const invoiceData = await readProfessionalInvoiceXml(xmlUrl, profile);

    const parsed = professionalInvoiceSchema.safeParse({
      referenceNumber: invoiceData.referenceNumber,
      amount: invoiceData.amount,
      fileUrl,
      xmlUrl,
      supplierFeClave: invoiceData.supplierFeClave,
      periodStart,
      periodEnd,
      settlementId,
    });
    if (!parsed.success) return { success: false, error: firstIssueMessage(parsed.error) };

    const { referenceNumber: ref, amount: amt, fileUrl: url, xmlUrl: xml, supplierFeClave: clave } = parsed.data;

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);

    let settlement = null;
    if (settlementId) {
      settlement = await prisma.settlement.findFirst({
        where: { id: String(settlementId), professionalId: profile.id, status: "OPEN" },
        select: { id: true, netAmount: true, taxRatePct: true },
      });
      if (!settlement) return { success: false, error: "La liquidación no está disponible para facturar." };
      if (Math.abs(amt - Number(settlement.netAmount)) > 0.005) {
        return { success: false, error: "El monto debe coincidir exactamente con el neto de la liquidación." };
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `PROV-DRAFT-${Date.now()}`,
        invoiceType: "SUPPLIER_INVOICE",
        status: "DRAFT",
        contactId: profile.userId,
        professionalId: profile.id,
        supplierReference: ref,
        attachmentUrl: url,
        xmlUrl: xml,
        supplierFeClave: clave,
        supplierIdNumber: invoiceData.supplierIdNumber,
        supplierEconomicActivity: invoiceData.supplierEconomicActivity,
        acceptanceStatus: "PENDING",
        invoiceDate: new Date(invoiceData.invoiceDate),
        dueDate,
        subtotal: invoiceData.subtotal,
        taxAmount: invoiceData.taxAmount,
        discountAmount: invoiceData.discountAmount,
        total: amt,
        amountPaid: 0,
        balance: amt,
        currency: invoiceData.currency,
        lines: {
          create: invoiceData.lines,
        },
      },
      select: { id: true, invoiceNumber: true },
    });

    if (settlement) {
      await prisma.settlement.update({
        where: { id: settlement.id },
        data: { invoiceId: invoice.id, status: "INVOICED" },
      });
    }

    revalidatePath("/panel/profesional/contabilidad");

    return { success: true, invoiceId: invoice.id };
  } catch (err) {
    if (err instanceof SupplierXmlError) return { success: false, error: err.message };
    console.error("[submitProfessionalInvoice] No se pudo presentar la factura.");
    return { success: false, error: "Error interno al presentar la factura." };
  }
}

export async function updateSupplierInvoiceAcceptance(invoiceId, acceptanceStatus) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false, error: "No autorizado." };
  const parsed = supplierAcceptanceSchema.safeParse({ invoiceId, acceptanceStatus });
  if (!parsed.success) return { success: false, error: firstIssueMessage(parsed.error) };

  const { invoiceId: id, acceptanceStatus: status } = parsed.data;
  await prisma.invoice.update({ where: { id }, data: { acceptanceStatus: status, acceptanceAt: new Date() } });
  revalidatePath("/panel/admin/contabilidad");
  return { success: true };
}

