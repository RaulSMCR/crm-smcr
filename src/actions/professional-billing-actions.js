"use server";

// src/actions/professional-billing-actions.js
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { splitTaxIncluded } from "@/lib/invoice-math";
import { validateSupplierFeClave } from "@/lib/supplier-invoice";

async function requireApprovedProfessional() {
  const session = await getSession();
  if (!session || session.role !== "PROFESSIONAL") {
    return { error: "No autorizado." };
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
}) {
  try {
    const auth = await requireApprovedProfessional();
    if (auth.error) return { success: false, error: auth.error };
    const { profile } = auth;

    const ref = String(referenceNumber || "").trim();
    const amt = Number(amount);
    const url = String(fileUrl || "").trim();
    const xml = String(xmlUrl || "").trim();
    const clave = String(supplierFeClave || "").trim();

    if (!ref) return { success: false, error: "El número de factura es obligatorio." };
    if (!amt || amt <= 0) return { success: false, error: "El monto debe ser mayor a cero." };
    if (!url) return { success: false, error: "Debes subir el PDF de la factura." };
    if (!xml) return { success: false, error: "Debes subir el XML firmado de la factura." };
    const claveValidation = validateSupplierFeClave(clave, profile.user?.identification);
    if (!claveValidation.ok) return { success: false, error: claveValidation.error };
    const { baseCents, taxCents } = splitTaxIncluded(Math.round(amt * 100), 4);
    const baseAmount = baseCents / 100;
    const taxAmount = taxCents / 100;

    const pStart = periodStart ? new Date(periodStart) : null;
    const pEnd = periodEnd ? new Date(periodEnd) : null;

    const periodLabel =
      pStart && pEnd
        ? `${pStart.toLocaleDateString("es-CR")} – ${pEnd.toLocaleDateString("es-CR")}`
        : "período reciente";

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);

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
  const status = acceptanceStatus === "ACCEPTED" || acceptanceStatus === "REJECTED" ? acceptanceStatus : null;
  if (!status) return { success: false, error: "Estado de aceptación inválido." };
  await prisma.invoice.update({ where: { id: String(invoiceId) }, data: { acceptanceStatus: status, acceptanceAt: new Date() } });
  revalidatePath("/panel/admin/contabilidad");
  return { success: true };
}

