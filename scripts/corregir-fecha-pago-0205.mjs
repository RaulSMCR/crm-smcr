// scripts/corregir-fecha-pago-0205.mjs
//
// Corrige la fecha de pago de la factura 0205 (Javier Aguilera, ₡40.000, SINPE).
//
// Qué pasó: el formulario de pagos manuales mostraba la hora del navegador.
// Raúl lo usó desde Argentina el 21-oct-2026 a las 22:48 de Costa Rica; el campo
// decía 22/10 01:48 (hora argentina), él corrigió el día al 21 —el de Costa
// Rica— y quedó 21/10 01:48 argentino = 20/10 22:48 CR: un día antes. El campo
// ya trabaja en hora tica (PagoManualForm.js); esto arregla el dato que quedó.
//
// Toca dos fechas internas: `Invoice.paymentDate` y `PaymentTransaction.paidAt`.
// No toca el comprobante: la fecha de pago no viaja a Hacienda.
//
// Uso (terminal de VS Code, desde la carpeta del proyecto):
//   node scripts/corregir-fecha-pago-0205.mjs            ← solo muestra
//   node scripts/corregir-fecha-pago-0205.mjs --aplicar  ← corrige
//
// Solo cambia lo que todavía tenga la fecha equivocada: correrlo de nuevo no hace nada.

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const MAL = new Date("2026-10-21T04:48:00Z"); // 20/10/2026 22:48 CR
const BIEN = new Date("2026-10-22T04:48:00Z"); // 21/10/2026 22:48 CR
const aplicar = process.argv.includes("--aplicar");

// El pooler de Supabase a veces tarda más de los 5 s que Prisma espera por
// defecto; se le dan 30 sin tocar el .env ni imprimir la URL.
const env = readFileSync(".env", "utf8");
const url = new URL(env.match(/^DIRECT_URL="?([^"\n]*)/m)[1]);
url.searchParams.set("connect_timeout", "30");
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

const cr = (d) => (d ? new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", dateStyle: "short", timeStyle: "short" }).format(d) : "—");

try {
  const factura = await prisma.invoice.findFirst({
    where: { invoiceNumber: "0205", invoiceType: "CUSTOMER_INVOICE" },
    select: { id: true, paymentDate: true, originDocument: true, total: true },
  });
  if (!factura) throw new Error("No se encontró la factura 0205.");
  const cobroId = String(factura.originDocument || "").replace("PAGO_MANUAL:", "");
  const cobro = await prisma.paymentTransaction.findUnique({ where: { id: cobroId }, select: { id: true, paidAt: true } });

  console.log(`Factura 0205 (₡${factura.total}) — fecha de pago: ${cr(factura.paymentDate)}`);
  console.log(`Cobro asociado             — fecha de pago: ${cr(cobro?.paidAt)}`);
  console.log(`Fecha correcta: ${cr(BIEN)} (hora de Costa Rica)`);

  if (!aplicar) {
    console.log("\nNo se cambió nada. Para corregir, agregue --aplicar.");
  } else {
    const [f, c] = await prisma.$transaction([
      prisma.invoice.updateMany({ where: { id: factura.id, paymentDate: MAL }, data: { paymentDate: BIEN } }),
      prisma.paymentTransaction.updateMany({ where: { id: cobroId, paidAt: MAL }, data: { paidAt: BIEN } }),
    ]);
    console.log(`\nCorregido: factura ${f.count}, cobro ${c.count}${f.count + c.count === 0 ? " (ya estaban bien)" : ""}.`);
  }
} catch (error) {
  console.error("No se pudo completar:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
