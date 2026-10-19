// scripts/fe-reparar-consecutivo-0189.mjs
//
// Repara el choque de consecutivos entre el sistema anterior y el CRM.
//
// El problema: el sistema anterior emitió hasta el consecutivo
// 00100001010000000202 para esta sucursal/terminal/tipo, y la InvoiceSequence
// del CRM venía en 189. La factura 0189 que el CRM generó el 2026-09-19 duplica
// un número que el sistema anterior ya usó, así que no se puede enviar a
// Hacienda: la serie debe ser continua y sin repeticiones. Y la siguiente que
// emitiera el CRM —0190— duplicaría otro.
//
// Lo que hace, todo en UNA transacción:
//   a) InvoiceSequence CUSTOMER_INVOICE → currentNumber = 202 (la próxima es 203)
//   b) la 0189 pasa a CANCELLED, anulada internamente y sin nota de crédito
//   c) su DeliveryJob FE_SUBMISSION en REVIEW se cierra
//   d) deja una factura nueva en DRAFT para la MISMA cita y el MISMO pago
//
// Por qué sin nota de crédito: una nota de crédito rectifica un comprobante que
// Hacienda aceptó. Este nunca llegó —`feRespuestaXml` está en NULL y la consulta
// de estado responde «El comprobante [...] no ha sido recibido.»—, así que no hay
// nada que rectificar ante Hacienda. La anulación es puramente interna.
//
// Por qué la 0189 conserva su feXml, su clave y su consecutivo: son la evidencia
// de lo que se intentó. Borrarlos dejaría la fila sin rastro de por qué se anuló.
// Quedar en CANCELLED ya la vuelve inenviable: la ruta submit-fe rechaza las
// facturas canceladas.
//
// Uso:
//   node scripts/fe-reparar-consecutivo-0189.mjs                 (simulación, NO escribe)
//   node scripts/fe-reparar-consecutivo-0189.mjs --aplicar       (escribe)
//
// Se corre con DATABASE_URL apuntando a la base que se quiere reparar:
//   node --env-file=.env.produccion scripts/fe-reparar-consecutivo-0189.mjs
//
// No contacta a Hacienda, no firma, no emite y no encola ningún envío.

import { PrismaClient } from "@prisma/client";

const APLICAR = process.argv.includes("--aplicar");

// Datos del caso, explícitos para que el script no adivine a qué fila le toca.
const INVOICE_ID = "cmu7ooory0004y546luwtripo"; // la 0189
const ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR = 202;
const TIPO = "CUSTOMER_INVOICE";

// El consecutivo de Hacienda que tiene que salir, confirmado por Raúl el
// 2026-10-19 como el disponible. Se verifica en vez de darse por bueno: el
// número de 20 dígitos no depende solo del contador, también de
// FE_EMISOR_SUCURSAL y FE_EMISOR_TERMINAL. Si en producción esas dos variables
// no fueran 001 y 00001, mover el contador a 202 produciría un número distinto
// del esperado, y el choque con el sistema anterior volvería a ocurrir en otro
// lugar de la serie.
const CONSECUTIVO_FE_ESPERADO = "00100001010000000203";

/**
 * Arma el consecutivo de Hacienda igual que `buildFeNumber` de
 * src/lib/fe/xml.js: sucursal(3) + terminal(5) + tipo(2) + consecutivo(10).
 *
 * Se reimplementa en vez de importarse porque ese módulo resuelve el alias `@/`,
 * que solo existe dentro de Next, y este script corre con node a secas. Si
 * cambiara la forma del número, esta copia hay que actualizarla; lo que la
 * protege es que el valor esperado está fijado arriba.
 */
function consecutivoFe(numero) {
  const sucursal = String(process.env.FE_EMISOR_SUCURSAL || "").trim();
  const terminal = String(process.env.FE_EMISOR_TERMINAL || "").trim();
  if (!sucursal || !terminal) return null;
  return `${sucursal}${terminal}01${String(numero).padStart(10, "0")}`;
}

const log = (...partes) => console.log(...partes);
const paso = (titulo) => log(`\n── ${titulo}`);

const prisma = new PrismaClient();

/**
 * Comprobaciones que tienen que pasar ANTES de escribir.
 *
 * Están separadas del cambio porque cada una corresponde a una suposición que,
 * si fuera falsa, convertiría la reparación en un daño: mover la secuencia por
 * encima de facturas existentes, anular una factura que Hacienda sí aceptó, o
 * duplicar la reemisión si el script ya se corrió.
 */
async function verificar(tx) {
  const problemas = [];
  const avisos = [];

  const factura = await tx.invoice.findUnique({
    where: { id: INVOICE_ID },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!factura) {
    problemas.push(`No existe Invoice ${INVOICE_ID} en esta base. ¿Es la base correcta?`);
    return { problemas, avisos };
  }

  log(`   Factura ${factura.invoiceNumber} · ${factura.invoiceType} · status=${factura.status}`);
  log(`   feStatus=${factura.feStatus} · feNumber=${factura.feNumber} · feRespuestaXml=${factura.feRespuestaXml ? "PRESENTE" : "null"}`);
  log(`   cita=${factura.appointmentId} · pago=${factura.originDocument} · total=${factura.total} ${factura.currency} · ${factura.lines.length} línea(s)`);

  // Si Hacienda la aceptó, esto NO es el procedimiento: haría falta una nota de
  // crédito y el caso cambia por completo.
  if (factura.feStatus === "ACCEPTED" || factura.feRespuestaXml) {
    problemas.push(
      "La 0189 tiene respuesta de Hacienda o está ACCEPTED: entonces SÍ llegó y anularla " +
        "internamente sería ocultar un comprobante emitido. Correspondería una nota de crédito.",
    );
  }
  if (factura.status === "CANCELLED") avisos.push("La 0189 ya está CANCELLED; ese paso no hará nada.");

  const secuencia = await tx.invoiceSequence.findUnique({ where: { sequenceType: TIPO } });
  if (!secuencia) {
    problemas.push(`No existe InvoiceSequence para ${TIPO}.`);
  } else {
    log(`   InvoiceSequence ${TIPO}: currentNumber=${secuencia.currentNumber} · padding=${secuencia.padding} · prefix="${secuencia.prefix ?? ""}"`);
    if (secuencia.currentNumber > ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR) {
      problemas.push(
        `La secuencia ya va en ${secuencia.currentNumber}, por encima de ${ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR}. ` +
          "Bajarla haría que el CRM repita números que ya emitió. Revisar a mano.",
      );
    }
  }

  // Ninguna factura del CRM puede estar ocupando el tramo que la secuencia va a
  // saltar: si existiera, al llegar ahí el número chocaría de nuevo.
  const enElTramo = await tx.invoice.findMany({
    where: { invoiceType: TIPO, id: { not: INVOICE_ID } },
    select: { id: true, invoiceNumber: true, status: true, feStatus: true },
  });
  const ocupadas = enElTramo.filter((f) => {
    const n = Number.parseInt(String(f.invoiceNumber).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > 0 && n <= ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR;
  });
  if (ocupadas.length) {
    avisos.push(
      `Hay ${ocupadas.length} factura(s) del CRM con número dentro del tramo 1..${ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR}: ` +
        `${ocupadas.map((f) => `${f.invoiceNumber}(${f.status}/${f.feStatus})`).join(", ")}. ` +
        "Son las que comparten numeración con el sistema anterior; revisar si alguna se envió.",
    );
  }

  // Idempotencia: si ya existe la reemisión, no crear otra.
  const yaReemitida = await tx.invoice.findFirst({
    where: { invoiceType: TIPO, originDocument: `REEMISION_DE:${INVOICE_ID}` },
    select: { id: true, invoiceNumber: true, status: true },
  });
  if (yaReemitida) {
    avisos.push(`La reemisión ya existe: ${yaReemitida.id} (${yaReemitida.invoiceNumber}, ${yaReemitida.status}). No se creará otra.`);
  }

  // Que el número que va a salir sea exactamente el que Raúl confirmó como
  // disponible. Sin esto, el script podría dejar la serie «arreglada» y producir
  // igual un consecutivo que choca.
  const proximoFe = consecutivoFe(ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR + 1);
  if (!proximoFe) {
    avisos.push(
      "No se pudieron leer FE_EMISOR_SUCURSAL y FE_EMISOR_TERMINAL, así que no se " +
        `verificó que el consecutivo resultante sea ${CONSECUTIVO_FE_ESPERADO}. ` +
        "Correlo con el entorno de producción cargado para comprobarlo.",
    );
  } else if (proximoFe !== CONSECUTIVO_FE_ESPERADO) {
    problemas.push(
      `El consecutivo que saldría es ${proximoFe} y se esperaba ${CONSECUTIVO_FE_ESPERADO}. ` +
        "Revisar FE_EMISOR_SUCURSAL y FE_EMISOR_TERMINAL antes de mover la serie.",
    );
  } else {
    log(`   Consecutivo de Hacienda que saldrá: ${proximoFe} ✅ (coincide con el disponible)`);
  }

  const job = await tx.deliveryJob.findUnique({ where: { dedupeKey: `FE_SUBMISSION:${INVOICE_ID}` } });
  if (job) log(`   DeliveryJob FE_SUBMISSION: ${job.status} · intentos=${job.attempts} · lastErrorCode=${job.lastErrorCode}`);
  else avisos.push("No hay DeliveryJob FE_SUBMISSION para la 0189; ese paso no hará nada.");

  return { problemas, avisos, factura, secuencia, job, yaReemitida };
}

async function main() {
  log(`\nREPARACIÓN DEL CONSECUTIVO — ${APLICAR ? "APLICANDO CAMBIOS" : "SIMULACIÓN (no escribe nada)"}`);
  log("No contacta a Hacienda, no firma, no emite, no encola envíos.");

  paso("Verificación previa");
  const previo = await prisma.$transaction((tx) => verificar(tx));

  for (const aviso of previo.avisos) log(`   ⚠️  ${aviso}`);
  if (previo.problemas.length) {
    log("\n❌ No se puede continuar:");
    for (const p of previo.problemas) log(`   · ${p}`);
    process.exitCode = 1;
    return;
  }
  log("   ✅ Verificación superada.");

  const { factura, secuencia, yaReemitida } = previo;
  const proximo = ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR + 1;
  const etiquetaProximo = String(proximo).padStart(secuencia.padding || 4, "0");

  paso("Cambios que se aplicarían");
  log(`   a) InvoiceSequence[${TIPO}].currentNumber: ${secuencia.currentNumber} → ${ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR}`);
  log(`      (la próxima factura validada tomará ${etiquetaProximo})`);
  log(`   b) Invoice ${factura.invoiceNumber}: status ${factura.status} → CANCELLED, con el motivo en notes`);
  log("      (conserva feXml, feClave y feNumber como evidencia)");
  log(`   c) DeliveryJob FE_SUBMISSION:${INVOICE_ID}: REVIEW → SUCCEEDED, con completedAt`);
  log(yaReemitida
    ? "   d) reemisión: ya existe, no se crea otra"
    : `   d) Invoice NUEVA en DRAFT para la cita ${factura.appointmentId}, copiando las ${factura.lines.length} línea(s)`);

  if (!APLICAR) {
    log("\nSimulación terminada. Nada se escribió. Volvé a correrlo con --aplicar para ejecutarlo.");
    return;
  }

  paso("Aplicando");
  const resultado = await prisma.$transaction(async (tx) => {
    // Se vuelve a verificar DENTRO de la transacción que escribe: entre la
    // simulación y el --aplicar pudo entrar un cobro y mover la secuencia.
    const control = await verificar(tx);
    if (control.problemas.length) throw new Error(`VERIFICACION_FALLIDA: ${control.problemas.join(" | ")}`);

    // (a) La secuencia queda en el último número que usó el sistema anterior,
    // así que el siguiente `increment: 1` entrega 203.
    const seq = await tx.invoiceSequence.update({
      where: { sequenceType: TIPO },
      data: { currentNumber: ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR },
    });

    // (b) Anulación interna. El motivo va en `notes` porque es donde queda a la
    // vista en el panel; `feErrorMessage` se reescribe para que no siga
    // diciendo «se conserva para reintento», que ya es falso.
    const anulada = await tx.invoice.update({
      where: { id: INVOICE_ID },
      data: {
        status: "CANCELLED",
        feErrorMessage:
          "Anulada internamente: el consecutivo duplicaba el del sistema anterior " +
          `(último emitido ahí: ${ULTIMO_CONSECUTIVO_SISTEMA_ANTERIOR}). Nunca fue recibida por Hacienda, ` +
          "así que no corresponde nota de crédito. Reemitida con consecutivo nuevo.",
        notes: `${factura.notes || ""} | ANULADA ${new Date().toISOString().slice(0, 10)}: consecutivo duplicado del sistema anterior; reemitida.`.trim(),
      },
    });

    // (c) Cerrar la tarea para que deje de figurar como trabajo pendiente. El
    // enum DeliveryJobStatus no tiene un valor «anulado», y agregarlo es una
    // migración aparte; SUCCEEDED es el único estado terminal disponible. Queda
    // el lastErrorCode como marca de que se cerró por anulación, no por envío.
    const job = await tx.deliveryJob.updateMany({
      where: { dedupeKey: `FE_SUBMISSION:${INVOICE_ID}` },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        lockedUntil: null,
        leaseToken: null,
        lastErrorCode: "FE_ANULADA_CONSECUTIVO_DUPLICADO",
      },
    });

    // (d) La reemisión. Queda en DRAFT y SIN número definitivo a propósito: el
    // consecutivo se reclama en la transacción que lo usa, que es la ruta
    // `POST /api/invoices/:id/validate` del panel. Así el 203 no se aparta
    // ahora para quedar colgando si algo más resulta estar mal; y mientras sea
    // DRAFT nada puede enviarla.
    let reemision = control.yaReemitida || null;
    if (!reemision) {
      reemision = await tx.invoice.create({
        data: {
          // Provisional y deliberadamente no numérico: si alguien intentara
          // emitirla sin validarla, `extractConsecutivo` falla en vez de armar
          // un consecutivo inventado.
          invoiceNumber: `REEMISION-${factura.invoiceNumber}`,
          invoiceType: factura.invoiceType,
          status: "DRAFT",
          documentType: factura.documentType,
          contactId: factura.contactId,
          appointmentId: factura.appointmentId,
          professionalId: factura.professionalId,
          contactName: factura.contactName,
          contactIdNumber: factura.contactIdNumber,
          contactIdType: factura.contactIdType,
          economicActivity: factura.economicActivity,
          paymentMethod: factura.paymentMethod,
          cuentaDeposito: factura.cuentaDeposito,
          currency: factura.currency,
          // Las fechas del documento nuevo son las de HOY, no las de la 0189:
          // la clave de Hacienda codifica la fecha de emisión y tiene que ser
          // la real. La fecha del pago sí se conserva.
          invoiceDate: new Date(),
          dueDate: new Date(),
          paymentDate: factura.paymentDate,
          subtotal: factura.subtotal,
          taxAmount: factura.taxAmount,
          discountAmount: factura.discountAmount,
          total: factura.total,
          amountPaid: factura.amountPaid,
          balance: factura.balance,
          // No se usa `originInvoiceId`: esa relación es la de las notas de
          // crédito y marcar acá una rectificación que no existe confundiría a
          // la ruta credit-note. El vínculo va en originDocument, que además es
          // lo que hace idempotente a este script.
          originDocument: `REEMISION_DE:${INVOICE_ID}`,
          notes: `Reemisión de ${factura.invoiceNumber} (consecutivo duplicado del sistema anterior). Pago original: ${factura.originDocument || "-"}.`,
          createdBy: factura.createdBy,
          lines: {
            create: factura.lines.map((l) => ({
              productId: l.productId,
              serviceId: l.serviceId,
              productName: l.productName,
              description: l.description,
              cabysCode: l.cabysCode,
              accountCode: l.accountCode,
              quantity: l.quantity,
              unitOfMeasure: l.unitOfMeasure,
              unitPrice: l.unitPrice,
              discountPercent: l.discountPercent,
              discountType: l.discountType,
              taxId: l.taxId,
              taxRate: l.taxRate,
              taxAmount: l.taxAmount,
              lineSubtotal: l.lineSubtotal,
              lineTotal: l.lineTotal,
              sortOrder: l.sortOrder,
            })),
          },
        },
        include: { lines: true },
      });
    }

    return { seq, anulada, jobs: job.count, reemision };
  });

  log(`   ✅ a) secuencia en ${resultado.seq.currentNumber}; la próxima será ${etiquetaProximo}`);
  log(`   ✅ b) ${resultado.anulada.invoiceNumber} → ${resultado.anulada.status}`);
  log(`   ✅ c) ${resultado.jobs} DeliveryJob cerrado(s)`);
  log(`   ✅ d) reemisión ${resultado.reemision.id} (${resultado.reemision.invoiceNumber}, ${resultado.reemision.status})`);
  log(
    `\nFalta un paso MANUAL: validar la reemisión desde el panel para que tome el ${etiquetaProximo} ` +
      "(POST /api/invoices/:id/validate). Esa ruta asigna el consecutivo y la pasa a PAID; " +
      "no envía nada a Hacienda por sí sola.",
  );
}

main()
  .catch((error) => {
    // El mensaje propio sí se muestra: lo escribimos nosotros y no lleva datos
    // del comprobante. Nada de trazas de Prisma, que incluyen la consulta.
    console.error(`\n❌ ${error?.message || "Error no previsto"}`);
    console.error("No se aplicó ningún cambio: todo iba en una sola transacción.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
