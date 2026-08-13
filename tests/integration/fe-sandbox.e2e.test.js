// tests/integration/fe-sandbox.e2e.test.js
//
// Prueba de punta a punta: cobro ONVO -> factura -> sandbox de Hacienda.
//
// NO corre con `npm test`. Toca la red (ONVO + Hacienda), escribe en la base y
// emite comprobantes reales contra el ambiente de pruebas. Se activa así:
//
//   FE_SANDBOX_E2E=1 npx vitest run tests/integration/fe-sandbox.e2e.test.js
//
// Todo lo que crea lo borra al terminar, incluida la factura emitida. El
// comprobante queda en el sandbox de Hacienda, que es justamente el objetivo.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPaymentLink } from "@/lib/onvo/client";
import { splitTaxIncluded } from "@/lib/invoice-math";
import { assertFeConfig, FE_EMISOR } from "@/lib/fe/config";
import { generateFeXml } from "@/lib/fe/xml";
import { submitToHacienda } from "@/lib/fe/client";

const ACTIVO = process.env.FE_SANDBOX_E2E === "1";
const describeE2E = ACTIVO ? describe : describe.skip;

// CABYS de prueba. Raúl debe fijar el definitivo al aprobar cada servicio; acá
// solo se necesita uno que Hacienda acepte para validar el circuito.
// CABYS real, tomado de una factura aceptada. Un codigo inventado se rechaza
// con el error -400 ("no se encuentra en el Catalogo de Bienes y Servicios").
const CABYS_PRUEBA = process.env.FE_SANDBOX_CABYS || "9310100002600";
const PRECIO = 48000; // precio final: IVA 4% incluido
const IVA_SALUD = 4;

const creado = { invoiceIds: [], appointmentIds: [], txIds: [] };
let contexto = null;

async function armarContexto() {
  const assignment = await prisma.serviceAssignment.findFirst({
    where: { status: "APPROVED" },
    include: {
      service: true,
      professional: { include: { user: true } },
    },
  });
  if (!assignment) throw new Error("No hay ninguna asignación aprobada.");

  const patient = await prisma.user.findFirst({ where: { role: "USER" } });
  if (!patient) throw new Error("No hay ningún paciente para la prueba.");

  const iva = await prisma.tax.findFirst({ where: { rate: 4, scope: "SALES", isActive: true } });
  if (!iva) throw new Error("No existe el IVA del 4% de servicios de salud.");

  return { assignment, patient, iva };
}

describeE2E("ONVO -> factura -> sandbox de Hacienda", () => {
  beforeAll(async () => {
    assertFeConfig();
    contexto = await armarContexto();

    // El servicio necesita clasificación fiscal para poder facturarse.
    const { service } = contexto.assignment;
    contexto.cabysOriginal = service.cabysCode;
    contexto.taxIdOriginal = service.taxId;

    if (!service.cabysCode || !service.taxId) {
      await prisma.service.update({
        where: { id: service.id },
        data: { cabysCode: service.cabysCode || CABYS_PRUEBA, taxId: service.taxId || contexto.iva.id },
      });
    }
  }, 60_000);

  afterAll(async () => {
    // Se deshace todo lo creado, y la clasificación fiscal vuelve a como estaba
    // para no dejar un CABYS inventado en un servicio real.
    if (creado.invoiceIds.length) {
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: creado.invoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: creado.invoiceIds } } });
    }
    if (creado.txIds.length) {
      await prisma.paymentTransaction.deleteMany({ where: { id: { in: creado.txIds } } });
    }
    if (creado.appointmentIds.length) {
      await prisma.appointment.deleteMany({ where: { id: { in: creado.appointmentIds } } });
    }
    if (contexto?.assignment?.service?.id) {
      await prisma.service.update({
        where: { id: contexto.assignment.service.id },
        data: { cabysCode: contexto.cabysOriginal, taxId: contexto.taxIdOriginal },
      });
    }
    await prisma.$disconnect();
  }, 60_000);

  it("el ambiente fiscal es el de pruebas, nunca el de producción", () => {
    expect(FE_EMISOR.ambiente).toBe("02");
  });

  it("ONVO cobra exactamente el precio final, sin sumarle nada", async () => {
    const link = await createPaymentLink({
      amount: PRECIO,
      description: "E2E sandbox - consulta de prueba",
    });

    expect(link.id).toMatch(/^test_/); // jamás un enlace live_ en esta prueba
    expect(link.url).toContain("buy.onvopay.com");

    // La página de cobro debe pedir el precio publicado tal cual.
    const checkout = await fetch(link.url, { redirect: "follow" });
    const html = await checkout.text();
    expect(html).toContain(String(PRECIO * 100));
  }, 60_000);

  it("emite la factura del cobro en el sandbox y Hacienda la acepta", async () => {
    const { assignment, patient, iva } = contexto;
    const { baseCents, taxCents } = splitTaxIncluded(PRECIO * 100, IVA_SALUD);

    // 1. La cita que originó el cobro.
    const inicio = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const appointment = await prisma.appointment.create({
      data: {
        date: inicio,
        endDate: new Date(inicio.getTime() + 60 * 60 * 1000),
        status: "COMPLETED",
        paymentStatus: "PAID",
        patientId: patient.id,
        professionalId: assignment.professionalId,
        serviceId: assignment.serviceId,
        pricePaid: PRECIO,
        locationName: "Consultorio de prueba",
        modality: "OFFICE",
      },
      select: { id: true },
    });
    creado.appointmentIds.push(appointment.id);

    // 2. La factura, con el IVA desglosado hacia adentro.
    const ahora = new Date();
    const invoice = await prisma.invoice.create({
      data: {
        // Consecutivo único por corrida: Hacienda rechaza con -99 si se repite
        // uno ya registrado. Se usa un rango alto para no chocar con la
        // secuencia real de facturación.
        invoiceNumber: `9${String(Date.now()).slice(-6)}`,
        invoiceType: "CUSTOMER_INVOICE",
        status: "PAID",
        contactId: patient.id,
        appointmentId: appointment.id,
        professionalId: assignment.professionalId,
        contactName: patient.name,
        contactIdNumber: patient.identification || null,
        paymentMethod: "card",
        invoiceDate: ahora,
        dueDate: ahora,
        subtotal: baseCents / 100,
        taxAmount: taxCents / 100,
        discountAmount: 0,
        total: PRECIO,
        amountPaid: PRECIO,
        balance: 0,
        currency: "CRC",
        notes: "Prueba E2E: cobro ONVO facturado en sandbox de Hacienda.",
        lines: {
          create: {
            productName: `Consulta - ${assignment.service.title}`,
            description: assignment.service.title,
            serviceId: assignment.serviceId,
            cabysCode: assignment.service.cabysCode || CABYS_PRUEBA,
            taxId: assignment.service.taxId || iva.id,
            quantity: 1,
            unitPrice: baseCents / 100,
            discountPercent: 0,
            taxRate: IVA_SALUD,
            taxAmount: taxCents / 100,
            lineSubtotal: baseCents / 100,
            lineTotal: PRECIO,
            sortOrder: 0,
          },
        },
      },
      select: { id: true },
    });
    creado.invoiceIds.push(invoice.id);

    // 3. El total facturado debe ser exactamente lo que pagó el paciente.
    const guardada = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { lines: true, contact: true, originInvoice: true },
    });

    expect(Number(guardada.subtotal) + Number(guardada.taxAmount)).toBeCloseTo(PRECIO, 2);
    expect(Number(guardada.total)).toBe(PRECIO);
    expect(Number(guardada.lines[0].taxRate)).toBe(IVA_SALUD);

    // 4. El XML debe declarar tarifa 4% con el código 04.
    // Ojo: la clave lleva un código de seguridad aleatorio, así que cada llamada
    // a generateFeXml produce una distinta. Esta es solo para inspeccionar el
    // contenido; la que vale es la que devuelve el envío.
    const { xml } = generateFeXml(guardada, guardada.lines);

    expect(xml).toContain("<CodigoTarifaIVA>04</CodigoTarifaIVA>");
    expect(xml).toContain("<Tarifa>4.00</Tarifa>");
    expect(xml).toContain("xml-schemas/v4.4/");

    // 5. Envío real al sandbox.
    const resultado = await submitToHacienda(guardada, guardada.lines);
    console.log(`\n[E2E] Clave enviada: ${resultado.feClave}`);
    console.log(`[E2E] Consecutivo   : ${resultado.feNumber}`);
    console.log(`[E2E] Hacienda dijo : ${resultado.feStatus}`);
    if (resultado.feErrorMessage) {
      console.log(`[E2E] Motivo        : ${String(resultado.feErrorMessage).slice(0, 800)}`);
    }

    expect(resultado.feClave).toHaveLength(50);
    expect(resultado.feStatus).toBe("ACCEPTED");
  }, 180_000);
});
