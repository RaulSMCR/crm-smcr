import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePaligOperator } from "@/lib/palig-auth";
import { generarFormularioDeFacturaPalig, generarPagoPalig, PALIG_CLAIM_SELECT, resumenPalig } from "@/lib/palig-service";
import { PaligError } from "@/lib/palig-pdf";
import { submitInvoiceToFe } from "@/lib/fe/submit";
import { processPaymentDeliveries } from "@/lib/payment-deliveries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const auth = await requirePaligOperator();
  if (auth.error) return auth.error;
  try {
    const fd = await request.formData();
    // Con una factura ya emitida solo se genera el formulario; si no, el pago
    // emite la factura nueva. La sesión es opcional: el eje es el comprobante.
    const invoiceId = fd.get("invoiceId") || null;
    const claim = invoiceId
      ? await generarFormularioDeFacturaPalig(prisma, { patientId: fd.get("patientId"), invoiceId, proof: fd.get("proof") })
      : await generarPagoPalig(prisma, {
          patientId: fd.get("patientId"), appointmentId: fd.get("appointmentId") || null,
          monto: Number(fd.get("monto")), confirmado: fd.get("confirmado") === "true",
          proof: fd.get("proof"), userId: auth.userId, referencia: fd.get("referencia"),
        });
    // Una factura que ya estaba aceptada no se vuelve a mandar a Hacienda.
    if (invoiceId) {
      const saved = await prisma.insuranceClaim.findUnique({ where: { id: claim.id }, select: PALIG_CLAIM_SELECT });
      return NextResponse.json(resumenPalig(saved), { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    // La factura ya existe. Un fallo de Hacienda no se convierte en error del
    // pago: se responde con su estado y se reutilizan los reintentos existentes.
    try { await submitInvoiceToFe(claim.invoiceId); } catch { console.error("[palig] FE_PENDING"); }
    after(() => processPaymentDeliveries({ invoiceId: claim.invoiceId }).catch(() => console.error("[palig] DELIVERY_PENDING")));
    const saved = await prisma.insuranceClaim.findUnique({ where: { id: claim.id }, select: PALIG_CLAIM_SELECT });
    return NextResponse.json(resumenPalig(saved), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PaligError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (["P2021", "P2022"].includes(error?.code)) return NextResponse.json({ message: "El piloto está pendiente de activación." }, { status: 503 });
    console.error("[palig] GENERATION_FAILED");
    return NextResponse.json({ message: "No se pudo completar la operación. Actualice la pantalla para comprobar si el pago quedó registrado antes de volver a enviarlo." }, { status: 500 });
  }
}
