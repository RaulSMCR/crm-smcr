// src/lib/pagos-manuales.js
//
// La segunda mitad del loop de pago y facturación, cuando la primera no pasó por
// ONVO.
//
// Con ONVO el recorrido está cerrado: el webhook acredita el cobro, crea la
// factura con su consecutivo, la manda a Hacienda y le envía el comprobante al
// paciente. Un pago en efectivo, por SINPE Móvil o por transferencia no tiene
// quien dispare nada, así que hasta ahora quedaba como ingreso sin comprobante:
// la plata entró y no hay documento que la respalde, que es exactamente la
// situación que la multa castiga.
//
// Acá el administrador reporta lo que ya ocurrió —cliente, monto, cuenta por la
// que entró— y desde ahí el sistema recorre lo mismo que recorrería un cobro de
// ONVO. No cobra nada ni contacta a ningún procesador: registra un pago que ya
// se hizo.
//
// Dos formas de cobro, porque son dos hechos distintos:
//
//   • CON CITA: hubo una consulta agendada. Además de la factura se registra el
//     PaymentTransaction, que es lo que hace que la cita quede pagada, que el
//     profesional perciba su parte en la liquidación y que la escalera de
//     precios ocupe su cupo. Sin él, el cobro no existe para nada de eso.
//
//   • SUELTO: un ingreso sin cita en el sistema. Solo factura. No hay
//     PaymentTransaction porque ese modelo exige una cita, y por lo tanto este
//     cobro NO entra en ninguna liquidación: es ingreso directo de la sociedad.
//
// Los dos caminos se limitan al profesional gestionado. El cobro de cualquier
// otro profesional tiene que pasar por ONVO: su comisión, su escalón y su
// liquidación se calculan sobre lo que el procesador confirma, y acreditar a
// mano un pago que nadie confirmó convierte el cálculo en una declaración de
// parte.

import { splitTaxIncluded } from "@/lib/invoice-math";
import { datosFacturacionDe } from "@/lib/fiscal-identity";
import { PRODUCTO_SERVICIOS_PROFESIONALES } from "@/lib/detalle-consulta";
import { createPaymentInvoice } from "@/lib/onvo/payment-invoice";
import { siguienteNumeroDeFactura } from "@/lib/invoice-sequence";
import { enqueueDelivery } from "@/lib/delivery-jobs";
import { ocuparCupoEnTransaccion } from "@/lib/price-ladder-server";
import { cuentaDeCobro } from "@/lib/cuentas-de-cobro";
import { revalidarPreciosPublicos } from "@/lib/revalidar-precios";

/**
 * Slug de la ficha del profesional gestionado.
 *
 * Es el mismo valor que `HUB_PROFILE_SLUG` de `src/lib/hub-raul.js`, repetido y
 * no importado a propósito: ese módulo arrastra el JSON del hub y su grafo
 * JSON-LD, y meter todo eso en el bundle de una función de facturación cuesta
 * megabytes de Functions Storage sin dar nada. Que los dos no se separen lo fija
 * `tests/unit/pagos-manuales.test.js`.
 */
export const SLUG_PROFESIONAL_GESTIONADO = "raul-olmedo";

/** Moneda única. Un cobro en otra moneda necesita tipo de cambio y no se acepta a mano. */
const MONEDA = "CRC";

/** Lo que hace falta del paciente para emitirle una factura y para el correo. */
const SELECT_CLIENTE = {
  id: true,
  name: true,
  email: true,
  identification: true,
  billingName: true,
  billingIdType: true,
  billingIdNumber: true,
  billingEmail: true,
};

const SELECT_SERVICIO = {
  id: true,
  title: true,
  cabysCode: true,
  taxId: true,
  tax: { select: { id: true, rate: true } },
};

function error(status, message, code) {
  return { ok: false, status, message, code };
}

/**
 * Receptor utilizable, con el mismo criterio que el XML de la 4.4.
 *
 * Se comprueba ANTES de reclamar el consecutivo. Si se descubriera al armar el
 * XML, el número ya estaría consumido en un documento que Hacienda no va a
 * aceptar, y la serie queda con un hueco que hay que explicar.
 */
function receptorUtilizable(cliente) {
  const receptor = datosFacturacionDe(cliente);
  if (!receptor.nombre || receptor.nombre.trim().length < 3) {
    return error(409, "El cliente no tiene nombre completo y la factura electrónica lo exige. Complete su perfil antes de facturar.", "RECEPTOR_SIN_NOMBRE");
  }
  if (!receptor.tipoIdentificacion || !receptor.identificacion) {
    return error(409, "El cliente no tiene identificación fiscal utilizable y la 4.4 la exige. Complete el tipo y el número en su perfil antes de facturar.", "RECEPTOR_SIN_IDENTIFICACION");
  }
  return { ok: true, receptor };
}

/** Un servicio sin CABYS o sin impuesto no se puede facturar sin inventarle los dos. */
function servicioFacturable(servicio) {
  if (!servicio) return error(404, "El servicio indicado no existe.", "SERVICIO_INEXISTENTE");
  if (!servicio.cabysCode || !servicio.taxId) {
    return error(409, `El servicio «${servicio.title}» no tiene CABYS o impuesto configurado. Complételo en el panel antes de facturar.`, "SERVICIO_SIN_CABYS");
  }
  return { ok: true, servicio };
}

function notasDeOrigen(cuenta, referencia) {
  const partes = [`Pago manual registrado por ADMIN`, `Cuenta: ${cuenta.etiqueta}`];
  if (referencia) partes.push(`Referencia: ${referencia}`);
  return partes.join(" | ");
}

/**
 * Registra un pago ya recibido y deja la factura lista para Hacienda.
 *
 * No envía nada por su cuenta: encola las entregas igual que el webhook de ONVO,
 * para que el envío a Hacienda y el correo al cliente los haga el mismo worker,
 * con los mismos reintentos y la misma protección contra duplicados.
 *
 * @param {object} prisma
 * @param {object} datos
 * @param {string} [datos.appointmentId] Cita cobrada. Sin ella es un cobro suelto.
 * @param {string} [datos.contactId]     Cliente del cobro suelto.
 * @param {string} [datos.serviceId]     Servicio del cobro suelto (de ahí sale el CABYS).
 * @param {string} [datos.descripcion]   Detalle de la línea del cobro suelto.
 * @param {number} datos.monto           Total recibido, impuesto incluido.
 * @param {string} datos.cuenta          Código del catálogo de cuentas.
 * @param {string} [datos.referencia]    Comprobante o número de la transacción.
 * @param {string} [datos.tipo]          Tipo del cobro de la cita (FULL_100 por defecto).
 * @param {Date}   [datos.fechaPago]     Cuándo se recibió. Hoy por defecto.
 * @param {string} [datos.registradoPor] Usuario que lo reporta.
 */
export async function registrarPagoManual(prisma, datos = {}) {
  const cuenta = cuentaDeCobro(datos.cuenta);
  if (!cuenta) return error(400, "Indique por cuál cuenta entró el dinero.", "CUENTA_INVALIDA");

  const monto = Number(datos.monto);
  if (!Number.isFinite(monto) || monto <= 0) return error(400, "El monto debe ser mayor a cero.", "MONTO_INVALIDO");

  const ahora = new Date();
  const fechaPago = datos.fechaPago ? new Date(datos.fechaPago) : ahora;
  if (Number.isNaN(fechaPago.getTime())) return error(400, "La fecha del pago no es válida.", "FECHA_INVALIDA");
  // Un pago no se puede reportar antes de haberse recibido. El margen absorbe el
  // reloj del navegador, que no siempre coincide con el del servidor.
  if (fechaPago.getTime() > ahora.getTime() + 5 * 60_000) {
    return error(400, "La fecha del pago no puede estar en el futuro.", "FECHA_FUTURA");
  }

  const resultado = datos.appointmentId
    ? await cobroDeCita(prisma, { ...datos, cuenta, monto, fechaPago, ahora })
    : await cobroSuelto(prisma, { ...datos, cuenta, monto, fechaPago, ahora });

  // La factura ya está creada: un fallo al revalidar el precio público no puede
  // convertirla en error.
  if (resultado.ok && resultado.cambiaPrecio) {
    try {
      revalidarPreciosPublicos();
    } catch (fallo) {
      console.error("No se pudieron revalidar los precios públicos:", fallo?.message);
    }
  }
  return resultado;
}

/** Cobro de una cita agendada: pago, cita, factura, liquidación y escalera. */
async function cobroDeCita(prisma, { appointmentId, cuenta, monto, fechaPago, tipo, referencia, registradoPor }) {
  const tipoCobro = tipo || "FULL_100";
  return prisma.$transaction(async (tx) => {
    const cita = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true, status: true, paymentStatus: true, date: true, pricePaid: true, priceTierId: true,
        patientId: true, professionalId: true, serviceId: true,
        service: { select: SELECT_SERVICIO },
        patient: { select: SELECT_CLIENTE },
        professional: { select: { id: true, slug: true, academicDegree: true, user: { select: { name: true, email: true } } } },
      },
    });
    if (!cita) return error(404, "La cita indicada no existe.", "CITA_INEXISTENTE");
    if (cita.professional?.slug !== SLUG_PROFESIONAL_GESTIONADO) {
      return error(409, "Solo se pueden reportar a mano los cobros del profesional gestionado. Los demás se cobran por ONVO.", "PROFESIONAL_NO_PERMITIDO");
    }
    if (String(cita.status || "").startsWith("CANCELLED")) {
      return error(409, "La cita está cancelada: no se le puede registrar un cobro.", "CITA_CANCELADA");
    }
    if (cita.paymentStatus === "REFUNDED") {
      return error(409, "La cita tiene un reembolso registrado. Revísela antes de cobrarla de nuevo.", "CITA_REEMBOLSADA");
    }
    if (cita.paymentStatus === "PAID") {
      return error(409, "La cita ya está pagada por completo.", "CITA_YA_PAGADA");
    }

    // Doble clic, pestaña duplicada, reporte repetido: el mismo cobro dos veces
    // son dos facturas con dos consecutivos y un ingreso inflado.
    const repetido = await tx.paymentTransaction.findFirst({
      where: { appointmentId, type: tipoCobro, status: "APPROVED" },
      select: { id: true },
    });
    if (repetido) return error(409, "Ese cobro ya está registrado para esta cita.", "COBRO_DUPLICADO");

    const servicio = servicioFacturable(cita.service);
    if (!servicio.ok) return servicio;
    const receptor = receptorUtilizable(cita.patient);
    if (!receptor.ok) return receptor;

    const transaccion = await tx.paymentTransaction.create({
      data: {
        appointmentId: cita.id,
        professionalId: cita.professionalId,
        patientId: cita.patientId,
        type: tipoCobro,
        amount: monto,
        currency: MONEDA,
        status: "APPROVED",
        paidAt: fechaPago,
        taxRate: Number(cita.service?.tax?.rate ?? 4),
        // Cero y no NULL: no hubo procesador, así que el costo de procesamiento
        // es cero de verdad. NULL haría que la liquidación lo estimara como si
        // hubiera pasado por ONVO y le descontara al profesional una comisión
        // que nadie cobró.
        processingFee: 0,
        statusMessage: notasDeOrigen(cuenta, referencia),
      },
    });

    const paymentStatus = tipoCobro === "DEPOSIT_50" ? "PARTIALLY_PAID" : "PAID";
    await tx.appointment.update({ where: { id: cita.id }, data: { paymentStatus } });

    const invoice = await createPaymentInvoice(
      tx,
      { ...transaccion, appointment: { ...cita, paymentStatus }, patient: cita.patient, professional: cita.professional },
      {
        paymentMethod: cuenta.medioPago,
        cuentaDeposito: cuenta.codigo,
        originDocument: `PAGO_MANUAL:${transaccion.id}`,
        notas: notasDeOrigen(cuenta, referencia),
      }
    );

    await enqueueDelivery(tx, { kind: "PAYMENT_CONFIRMATION", invoiceId: invoice.invoiceId, paymentTransactionId: transaccion.id });
    await enqueueDelivery(tx, { kind: "FE_SUBMISSION", invoiceId: invoice.invoiceId });

    // Igual que en el webhook: el pago de la primera cita de un paciente nuevo
    // ocupa su cupo en la escalera dentro de esta misma transacción.
    const escalera = await ocuparCupoEnTransaccion(tx, {
      id: cita.id,
      patientId: cita.patientId,
      professionalId: cita.professionalId,
      serviceId: cita.serviceId,
      pricePaid: cita.pricePaid,
      priceTierId: cita.priceTierId,
    });

    return {
      ok: true,
      modo: "cita",
      invoiceId: invoice.invoiceId,
      transactionId: transaccion.id,
      appointmentId: cita.id,
      paymentStatus,
      registradoPor: registradoPor || null,
      cambiaPrecio: escalera.cambiaPrecio,
    };
  }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
}

/**
 * Ingreso sin cita: solo factura.
 *
 * No crea PaymentTransaction —ese modelo exige una cita— y por lo tanto este
 * cobro no aparece en ninguna liquidación ni mueve la escalera de precios. Es
 * ingreso directo de la sociedad, y así queda registrado.
 */
async function cobroSuelto(prisma, { contactId, serviceId, descripcion, cuenta, monto, fechaPago, ahora, referencia, registradoPor }) {
  if (!contactId) return error(400, "Indique el cliente al que se le factura.", "CLIENTE_REQUERIDO");
  if (!serviceId) return error(400, "Indique el servicio: de ahí salen el CABYS y el impuesto de la línea.", "SERVICIO_REQUERIDO");
  const detalle = String(descripcion || "").trim();
  if (detalle.length < 5) return error(400, "Describa qué se cobró: es el detalle que lee el cliente en la factura.", "DESCRIPCION_REQUERIDA");

  return prisma.$transaction(async (tx) => {
    const [cliente, servicioCrudo, profesional] = await Promise.all([
      tx.user.findUnique({ where: { id: contactId }, select: SELECT_CLIENTE }),
      tx.service.findUnique({ where: { id: serviceId }, select: SELECT_SERVICIO }),
      tx.professionalProfile.findUnique({ where: { slug: SLUG_PROFESIONAL_GESTIONADO }, select: { id: true } }),
    ]);
    if (!cliente) return error(404, "El cliente indicado no existe.", "CLIENTE_INEXISTENTE");
    if (!profesional) return error(409, "No se encontró la ficha del profesional gestionado.", "PROFESIONAL_INEXISTENTE");

    const servicio = servicioFacturable(servicioCrudo);
    if (!servicio.ok) return servicio;
    const receptor = receptorUtilizable(cliente);
    if (!receptor.ok) return receptor;

    const taxRate = Number(servicioCrudo.tax?.rate ?? 4);
    const { baseCents, taxCents } = splitTaxIncluded(Math.round(monto * 100), taxRate);
    const baseAmount = baseCents / 100;
    const taxAmount = taxCents / 100;

    // La fecha de emisión es hoy, no la del pago: Hacienda rechaza comprobantes
    // fechados fuera de su ventana. Cuándo entró la plata es `paymentDate`.
    const invoiceNumber = await siguienteNumeroDeFactura(tx, "CUSTOMER_INVOICE", ahora);
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        invoiceType: "CUSTOMER_INVOICE",
        status: "PAID",
        contactId: cliente.id,
        professionalId: profesional.id,
        contactName: receptor.receptor.nombre,
        contactIdNumber: receptor.receptor.identificacion,
        contactIdType: receptor.receptor.tipoIdentificacion,
        paymentMethod: cuenta.medioPago,
        cuentaDeposito: cuenta.codigo,
        invoiceDate: ahora,
        dueDate: ahora,
        paymentDate: fechaPago,
        subtotal: baseAmount,
        taxAmount,
        discountAmount: 0,
        total: monto,
        amountPaid: monto,
        balance: 0,
        currency: MONEDA,
        originDocument: "PAGO_MANUAL_SIN_CITA",
        notes: notasDeOrigen(cuenta, referencia),
        createdBy: registradoPor || null,
        lines: { create: {
          productName: PRODUCTO_SERVICIOS_PROFESIONALES,
          description: detalle,
          serviceId: servicioCrudo.id,
          cabysCode: servicioCrudo.cabysCode,
          taxId: servicioCrudo.taxId,
          quantity: 1,
          unitPrice: baseAmount,
          discountPercent: 0,
          taxRate,
          taxAmount,
          lineSubtotal: baseAmount,
          lineTotal: monto,
          sortOrder: 0,
        } },
      },
      select: { id: true, invoiceNumber: true },
    });

    await enqueueDelivery(tx, { kind: "FE_SUBMISSION", invoiceId: invoice.id });

    return {
      ok: true,
      modo: "suelto",
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      registradoPor: registradoPor || null,
      cambiaPrecio: false,
    };
  }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
}
