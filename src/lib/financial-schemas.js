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

export function validationMessage(error) {
  return error.issues?.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") || "Datos inválidos.";
}
