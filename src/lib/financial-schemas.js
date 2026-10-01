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

/**
 * Pago que el administrador reporta a mano, para facturarlo.
 *
 * Lo que decide la forma del cobro es `appointmentId`: con cita se registra
 * además el pago (liquidación y escalera incluidas); sin ella es un ingreso
 * suelto que solo se factura, y entonces hacen falta cliente, servicio —de donde
 * salen el CABYS y el impuesto— y el detalle que el cliente va a leer.
 *
 * La cuenta NO se valida acá: el catálogo vive en `src/lib/cuentas-de-cobro.js`
 * y lo comprueba `registrarPagoManual`, que es quien también deriva el medio de
 * pago fiscal. Duplicar la lista en un enum de zod sería dos listas que se
 * separan.
 */
export const pagoManualSchema = z
  .object({
    appointmentId: z.string().trim().min(1).nullish(),
    contactId: z.string().trim().min(1).nullish(),
    serviceId: z.string().trim().min(1).nullish(),
    descripcion: z.string().trim().min(5, "Describa qué se cobró, con al menos 5 caracteres.").nullish(),
    monto: decimal("monto").positive("El monto debe ser mayor a cero."),
    cuenta: z.string().trim().min(1, "Indique por cuál cuenta entró el dinero."),
    referencia: z.string().trim().max(120, "La referencia admite hasta 120 caracteres.").nullish(),
    tipo: z.enum(["DEPOSIT_50", "BALANCE_50", "FULL_100", "PENALTY_50"], { message: "Tipo de cobro inválido." }).nullish(),
    fechaPago: isoDate("fechaPago").nullish(),
  })
  .refine((value) => Boolean(value.appointmentId) || Boolean(value.contactId && value.serviceId && value.descripcion), {
    message: "Sin cita hay que indicar cliente, servicio y descripción del cobro.",
    path: ["appointmentId"],
  })
  .refine((value) => !value.tipo || Boolean(value.appointmentId), {
    message: "El tipo de cobro solo aplica a un pago de una cita.",
    path: ["tipo"],
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
