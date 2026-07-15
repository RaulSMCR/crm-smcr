import { z } from "zod";

const decimal = (label) => z.coerce.number({ message: `${label} debe ser numérico.` }).finite(`${label} debe ser finito.`);

export const invoiceLineSchema = z.object({
  productName: z.string().trim().min(1, "productName es requerido.").optional(),
  quantity: decimal("quantity").positive("quantity debe ser mayor a 0.").optional(),
  unitPrice: decimal("unitPrice").nonnegative("unitPrice no puede ser negativo.").optional(),
  discountPercent: decimal("discountPercent").min(0).max(100).optional(),
  taxRate: decimal("taxRate").min(0).max(100).optional(),
}).passthrough();

export const invoiceBodySchema = z.object({
  lines: z.array(invoiceLineSchema, { message: "lines debe ser un arreglo." }).optional(),
}).passthrough();

export const productBodySchema = z.object({
  name: z.string().trim().min(1, "name es requerido."),
  salePrice: decimal("salePrice").nonnegative().optional(),
  costPrice: decimal("costPrice").nonnegative().optional(),
}).passthrough();

// `z.coerce.date()` sola convertiría null/"" en la época de 1970: exigimos Date o string con contenido.
const isoDate = (label) =>
  z
    .union([z.date(), z.string().trim().min(1)], { message: `${label} debe ser una fecha válida.` })
    .pipe(z.coerce.date({ message: `${label} debe ser una fecha válida.` }));

export const settlementPeriodSchema = z
  .object({
    periodStart: isoDate("periodStart"),
    periodEnd: isoDate("periodEnd"),
  })
  .refine((value) => value.periodStart <= value.periodEnd, {
    message: "periodStart no puede ser posterior a periodEnd.",
    path: ["periodStart"],
  });

export const settlementInvoiceIdSchema = z.object({
  invoiceId: z.string().trim().min(1, "invoiceId es requerido."),
});

export const professionalInvoiceSchema = z.object({
  referenceNumber: z.string().trim().min(1, "El número de factura es obligatorio."),
  amount: decimal("amount").positive("El monto debe ser mayor a cero."),
  fileUrl: z.string().trim().min(1, "Debes subir el PDF de la factura."),
  xmlUrl: z.string().trim().min(1, "Debes subir el XML firmado de la factura."),
  supplierFeClave: z.string().trim().default(""),
  periodStart: isoDate("periodStart").nullish(),
  periodEnd: isoDate("periodEnd").nullish(),
  settlementId: z.string().trim().min(1).nullish(),
});

export const supplierAcceptanceSchema = z.object({
  invoiceId: z.string().trim().min(1, "invoiceId es requerido."),
  acceptanceStatus: z.enum(["ACCEPTED", "REJECTED"], { message: "Estado de aceptación inválido." }),
});

export function validationMessage(error) {
  return error.issues?.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") || "Datos inválidos.";
}

/** Mensaje para server actions: el texto del primer campo inválido, sin el prefijo de ruta. */
export function firstIssueMessage(error) {
  return error.issues?.[0]?.message || "Datos inválidos.";
}
