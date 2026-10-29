import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePaligOperator } from "@/lib/palig-auth";
import { PALIG_PROFESSIONAL_SLUG } from "@/lib/palig-policy";
import { resumenPalig } from "@/lib/palig-service";
import { enviarFirmadoPalig, firmarTramitePalig, moverFirmaTramitePalig, rutaFirmado } from "@/lib/palig-firma";
import { facturaPaligPdf, PaligError } from "@/lib/palig-pdf";
import { getSignedUrl, parseStorageReference } from "@/lib/storage";
import { descargarDelTramite } from "@/lib/palig-storage";
import { FE_EMISOR } from "@/lib/fe/config";
import { submitInvoiceToFe } from "@/lib/fe/submit";
import { processPaymentDeliveries } from "@/lib/payment-deliveries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function context(id) {
  const auth = await requirePaligOperator();
  if (auth.error) return auth;
  const claim = await prisma.insuranceClaim.findFirst({ where: { id, invoiceId: { not: null }, professional: { slug: PALIG_PROFESSIONAL_SLUG } }, include: {
    invoice: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
    patient: { select: { id: true, name: true, email: true, insuranceTemplateUrl: true } },
  } });
  if (!claim?.invoice) return { error: NextResponse.json({ message: "Documentos no disponibles." }, { status: 404 }) };
  return { claim };
}

export async function GET(request, { params }) {
  const ctx = await context((await params).id);
  if (ctx.error) return ctx.error;
  const { claim } = ctx;
  const url = new URL(request.url);
  const kind = url.searchParams.get("file");
  try {
    if (!kind) return NextResponse.json(resumenPalig(claim), { headers: { "Cache-Control": "no-store" } });
    if (["invoice", "xml", "form", "firmado"].includes(kind) && !["OPEN", "PAID"].includes(claim.invoice.status)) throw new PaligError("La factura fue cancelada. Revise el trámite antes de usar estos documentos.", 409);
    if (kind === "invoice") {
      return new Response(await facturaPaligPdf(claim.invoice, FE_EMISOR), { headers: {
        "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="Factura.pdf"', "Cache-Control": "no-store",
      } });
    }
    if (kind === "xml") {
      if (!resumenPalig(claim).invoiceReady) throw new PaligError("El XML aceptado todavía no está disponible.", 409);
      return new Response(claim.invoice.feXml, { headers: { "Content-Type": "application/xml", "Content-Disposition": 'attachment; filename="Factura.xml"', "Cache-Control": "no-store" } });
    }
    const reference = { form: claim.generatedFormUrl, proof: claim.paymentProofUrl, template: claim.templateSnapshotUrl, firmado: rutaFirmado(claim) }[kind];
    const ref = parseStorageReference(reference);
    if (!ref || ref.bucket !== "insurance-signed-forms" || !ref.path.startsWith(`${claim.id}/palig/`)) throw new PaligError("Documento no disponible.", 404);
    // `ver=1`: los bytes desde este mismo dominio, para el visor de la página
    // (pdf.js). En Android el PDF no se puede mostrar dentro de la página y el
    // enlace lo abría en otra app. Solo los PDF del trámite, no el comprobante.
    if (url.searchParams.get("ver") === "1" && ["form", "firmado", "template"].includes(kind)) {
      return new Response(await descargarDelTramite(reference, claim.id), { headers: {
        "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "no-store",
      } });
    }
    const response = NextResponse.redirect(await getSignedUrl(ref.bucket, ref.path, 120));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof PaligError ? error.message : "No se pudo descargar el documento." }, { status: error instanceof PaligError ? error.status : 503 });
  }
}

/**
 * POST sin cuerpo: actualiza el estado fiscal.
 * { accion: "firmar" }: estampa la siguiente versión de la firma de Raúl.
 * { accion: "moverFirma", dx, dy }: corre la firma de un formulario escaneado.
 * { accion: "enviar" }: manda al paciente el formulario firmado.
 */
export async function POST(request, { params }) {
  const ctx = await context((await params).id);
  if (ctx.error) return ctx.error;
  if (!["OPEN", "PAID"].includes(ctx.claim.invoice.status)) return NextResponse.json({ message: "La factura fue cancelada." }, { status: 409 });
  const body = (await request?.json().catch(() => ({}))) ?? {};
  const { accion } = body;
  if (["firmar", "moverFirma", "enviar"].includes(accion)) {
    try {
      const resumen = (claim) => NextResponse.json({ ...resumenPalig(claim), escaneada: Boolean(claim.escaneada) }, { headers: { "Cache-Control": "no-store" } });
      if (accion === "firmar") return resumen(await firmarTramitePalig(prisma, ctx.claim));
      if (accion === "moverFirma") {
        const dx = Number(body.dx || 0);
        const dy = Number(body.dy || 0);
        if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 50 || Math.abs(dy) > 50) throw new PaligError("Movimiento no válido.");
        return resumen(await moverFirmaTramitePalig(prisma, ctx.claim, { dx, dy, patient: ctx.claim.patient }));
      }
      return NextResponse.json(await enviarFirmadoPalig(prisma, ctx.claim, { patient: ctx.claim.patient }), { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof PaligError) return NextResponse.json({ message: error.message }, { status: error.status });
      console.error(accion === "enviar" ? "[palig] SEND_FAILED" : "[palig] SIGN_FAILED");
      return NextResponse.json({ message: accion === "enviar" ? "No se pudo enviar el formulario." : "No se pudo firmar el formulario." }, { status: 500 });
    }
  }
  try { await submitInvoiceToFe(ctx.claim.invoiceId); } catch { console.error("[palig] FE_PENDING"); }
  after(() => processPaymentDeliveries({ invoiceId: ctx.claim.invoiceId }).catch(() => console.error("[palig] DELIVERY_PENDING")));
  const latest = await prisma.insuranceClaim.findUnique({ where: { id: ctx.claim.id }, include: { invoice: true } });
  return NextResponse.json(resumenPalig(latest), { headers: { "Cache-Control": "no-store" } });
}
