import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePaligOperator } from "@/lib/palig-auth";
import { PALIG_PROFESSIONAL_SLUG } from "@/lib/palig-policy";
import { resumenPalig } from "@/lib/palig-service";
import { facturaPaligPdf, PaligError } from "@/lib/palig-pdf";
import { getSignedUrl, parseStorageReference } from "@/lib/storage";
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
  } });
  if (!claim?.invoice) return { error: NextResponse.json({ message: "Documentos no disponibles." }, { status: 404 }) };
  return { claim };
}

export async function GET(request, { params }) {
  const ctx = await context((await params).id);
  if (ctx.error) return ctx.error;
  const { claim } = ctx;
  const kind = new URL(request.url).searchParams.get("file");
  try {
    if (!kind) return NextResponse.json(resumenPalig(claim), { headers: { "Cache-Control": "no-store" } });
    if (["invoice", "xml", "form"].includes(kind) && !["OPEN", "PAID"].includes(claim.invoice.status)) throw new PaligError("La factura fue cancelada. Revise el trámite antes de usar estos documentos.", 409);
    if (kind === "invoice") {
      return new Response(await facturaPaligPdf(claim.invoice, FE_EMISOR), { headers: {
        "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="Factura.pdf"', "Cache-Control": "no-store",
      } });
    }
    if (kind === "xml") {
      if (!resumenPalig(claim).invoiceReady) throw new PaligError("El XML aceptado todavía no está disponible.", 409);
      return new Response(claim.invoice.feXml, { headers: { "Content-Type": "application/xml", "Content-Disposition": 'attachment; filename="Factura.xml"', "Cache-Control": "no-store" } });
    }
    const reference = { form: claim.generatedFormUrl, proof: claim.paymentProofUrl, template: claim.templateSnapshotUrl }[kind];
    const ref = parseStorageReference(reference);
    if (!ref || ref.bucket !== "insurance-signed-forms" || !ref.path.startsWith(`${claim.id}/palig/`)) throw new PaligError("Documento no disponible.", 404);
    const response = NextResponse.redirect(await getSignedUrl(ref.bucket, ref.path, 120));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof PaligError ? error.message : "No se pudo descargar el documento." }, { status: error instanceof PaligError ? error.status : 503 });
  }
}

export async function POST(_request, { params }) {
  const ctx = await context((await params).id);
  if (ctx.error) return ctx.error;
  if (!["OPEN", "PAID"].includes(ctx.claim.invoice.status)) return NextResponse.json({ message: "La factura fue cancelada." }, { status: 409 });
  try { await submitInvoiceToFe(ctx.claim.invoiceId); } catch { console.error("[palig] FE_PENDING"); }
  after(() => processPaymentDeliveries({ invoiceId: ctx.claim.invoiceId }).catch(() => console.error("[palig] DELIVERY_PENDING")));
  const latest = await prisma.insuranceClaim.findUnique({ where: { id: ctx.claim.id }, include: { invoice: true } });
  return NextResponse.json(resumenPalig(latest), { headers: { "Cache-Control": "no-store" } });
}
