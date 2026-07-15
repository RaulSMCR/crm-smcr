"use server";

// src/actions/professional-billing-actions.js
import { prisma } from "@/lib/prisma";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { splitTaxIncluded } from "@/lib/invoice-math";
import { validateSupplierFeClave } from "@/lib/supplier-invoice";
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
    select: { id: true, userId: true, commission: true, isApproved: true, user: { select: { identification: true } } },
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
  referenceNumber,
  amount,
  fileUrl,
  xmlUrl,
  supplierFeClave,
  periodStart,
  periodEnd,
  settlementId,
}) {
  try {
    const auth = await requireApprovedProfessional();
    if (auth.error) return { success: false, error: auth.error };
    const { profile } = auth;

    const parsed = professionalInvoiceSchema.safeParse({
      referenceNumber,
      amount,
      fileUrl,
      xmlUrl,
      supplierFeClave,
      periodStart,
      periodEnd,
      settlementId,
    });
    if (!parsed.success) return { success: false, error: firstIssueMessage(parsed.error) };

    const { referenceNumber: ref, amount: amt, fileUrl: url, xmlUrl: xml, supplierFeClave: clave } = parsed.data;

    const claveValidation = validateSupplierFeClave(clave, profile.user?.identification);
    if (!claveValidation.ok) return { success: false, error: claveValidation.error };
    const { baseCents, taxCents } = splitTaxIncluded(Math.round(amt * 100), 4);
    const baseAmount = baseCents / 100;
    const taxAmount = taxCents / 100;

    const pStart = parsed.data.periodStart ?? null;
    const pEnd = parsed.data.periodEnd ?? null;

    const periodLabel =
      pStart && pEnd
        ? `${pStart.toLocaleDateString("es-CR")} – ${pEnd.toLocaleDateString("es-CR")}`
        : "período reciente";

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);

    let settlement = null;
    if (settlementId) {
      settlement = await prisma.settlement.findFirst({
        where: { id: String(settlementId), professionalId: profile.id, status: "OPEN" },
        select: { id: true, netAmount: true },
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
        supplierIdNumber: String(profile.user?.identification || "").replace(/\D/g, ""),
        acceptanceStatus: "PENDING",
        invoiceDate: now,
        dueDate,
        subtotal: baseAmount,
        taxAmount,
        discountAmount: 0,
        total: amt,
        amountPaid: 0,
        balance: amt,
        currency: "CRC",
        lines: {
          create: {
            productName: `Honorarios profesionales - ${periodLabel}`,
            quantity: 1,
            unitPrice: baseAmount,
            discountPercent: 0,
            taxRate: 4,
            taxAmount,
            lineSubtotal: baseAmount,
            lineTotal: amt,
            sortOrder: 0,
          },
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
    console.error("[submitProfessionalInvoice] error:", err);
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

