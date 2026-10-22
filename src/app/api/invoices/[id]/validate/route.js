import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-guards";
import { esReemision } from "@/lib/fe/reemision";
import { PREFIJO_DE_SERIE, serieDeVentaSegunReceptor } from "@/lib/fiscal-identity";
import { faltaParaEmitir } from "@/lib/invoice-draft-lines";

export const dynamic = "force-dynamic";

function padNumber(value, digits) {
  return String(value).padStart(digits, "0");
}

// El año impreso en las series de proveedor es el de la emisión, no el campo
// `year` de la fila: ese registra cuándo arrancó la serie y no se actualiza.
// Antes daban el mismo resultado solo porque `year` se sobrescribía en el mismo
// upsert; leerlo de `now` lo vuelve explícito y deja de depender de ese efecto.
function buildInvoiceNumber(invoiceType, sequence, now) {
  const n = sequence.currentNumber;
  const padded = padNumber(n, sequence.padding || 4);

  if (invoiceType === "SUPPLIER_INVOICE") {
    return `${sequence.prefix || "FACT/"}${now.getFullYear()}/${padded}`;
  }

  if (invoiceType === "SUPPLIER_CREDIT_NOTE") {
    return `${sequence.prefix || "NC-PROV/"}${now.getFullYear()}/${padded}`;
  }

  return `${sequence.prefix || ""}${padded}`;
}



export async function POST(_request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String((await params)?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          lines: {
            include: {
              service: { select: { cabysCode: true } },
              product: { select: { cabysCode: true } },
            },
          },
        },
      });
      if (!invoice) return { error: { message: "Factura no encontrada.", status: 404 } };
      if (invoice.status !== "DRAFT") {
        return { error: { message: "Solo se puede validar una factura en borrador.", status: 409 } };
      }
      if (!invoice.lines.length) {
        return { error: { message: "La factura no tiene líneas.", status: 400 } };
      }
      // Antes de tomar el consecutivo: un borrador que Hacienda no va a aceptar
      // no puede quemar un número de la serie.
      if (invoice.invoiceType === "CUSTOMER_INVOICE") {
        const falta = faltaParaEmitir(invoice);
        if (falta) return { error: { message: falta, status: 409 } };
      }
      // La serie no sale del `invoiceType` sino del receptor: una venta a un
      // extranjero no domiciliado se emite como Tiquete Electrónico y Hacienda
      // exige el consecutivo continuo por tipo de comprobante, así que lleva
      // serie propia. La factura queda igual —mismo invoiceType, mismos
      // informes—, cambia el número y el comprobante.
      const serie =
        invoice.invoiceType === "CUSTOMER_INVOICE"
          ? serieDeVentaSegunReceptor(invoice.contactIdType)
          : invoice.invoiceType;

      const DEFAULT_SEQ_PREFIX = {
        ...PREFIJO_DE_SERIE,
        SUPPLIER_INVOICE: "FACT/",
        CUSTOMER_CREDIT_NOTE: "",
        SUPPLIER_CREDIT_NOTE: "NC-PROV/",
      };
      // Solo incrementa: la serie no se reinicia nunca, ni al cambiar el año.
      // Ver el encabezado de src/lib/invoice-sequence.js.
      const sequence = await tx.invoiceSequence.upsert({
        where: { sequenceType: serie },
        update: { currentNumber: { increment: 1 } },
        create: { sequenceType: serie, currentNumber: 1, year: now.getFullYear(), prefix: DEFAULT_SEQ_PREFIX[serie] ?? "", padding: 4 },
      });

      const nextNumber = buildInvoiceNumber(serie, sequence, now);
      const balance = Math.max(0, Number(invoice.total) - Number(invoice.amountPaid));
      const nextStatus = balance <= 0 ? "PAID" : "OPEN";

      // Una reemisión ya viene con el pago de la factura que reemplaza: el dinero
      // entró cuando entró, y validarla no puede moverle la fecha. Lo que sí
      // cambia es la fecha del comprobante, que tiene que ser la de la emisión
      // real porque la clave de Hacienda la codifica; el borrador pudo quedar
      // esperando días antes de que alguien lo validara.
      const reemision = esReemision(invoice);
      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          invoiceNumber: nextNumber,
          status: nextStatus,
          balance,
          paymentDate: nextStatus === "PAID" ? (invoice.paymentDate || now) : null,
          ...(reemision ? { invoiceDate: now, dueDate: now } : {}),
          feStatus: "PENDING",
        },
      });

      return { invoice: updated };
    });

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: result.error.status });
    }

    return NextResponse.json({
      id: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      status: result.invoice.status,
      balance: Number(result.invoice.balance),
    });
  } catch (error) {
    console.error("[invoices/:id/validate] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
