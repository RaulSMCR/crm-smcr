#!/usr/bin/env node
// scripts/fe-set-consecutivo.mjs
//
// Alinea la numeración consecutiva del CRM con la del sistema al que releva.
//
// Hacienda lleva una secuencia por (cédula, sucursal, terminal, tipo de
// documento). Si el CRM arranca en un número ya emitido por el sistema anterior,
// cada comprobante se rechaza con el error -99 ("la numeración consecutiva ya
// existe") hasta superar el último usado. Por eso, al hacer el corte hay que
// dejar la secuencia justo en el último número emitido: el CRM seguirá desde el
// siguiente.
//
// Uso:
//   node scripts/fe-set-consecutivo.mjs                      (solo muestra el estado)
//   node scripts/fe-set-consecutivo.mjs CUSTOMER_INVOICE 178  (deja listo el 179)
//
// El número que se pasa es el ÚLTIMO EMITIDO por el sistema anterior, no el
// próximo. Verificarlo en el comprobante más reciente: los últimos 10 dígitos
// del NumeroConsecutivo (00100001010000000178 -> 178).

import { PrismaClient } from "@prisma/client";

const TIPOS = [
  "CUSTOMER_INVOICE",
  "CUSTOMER_CREDIT_NOTE",
  "SUPPLIER_INVOICE",
  "SUPPLIER_CREDIT_NOTE",
];

const prisma = new PrismaClient();

async function mostrarEstado() {
  const seqs = await prisma.invoiceSequence.findMany({ orderBy: { sequenceType: "asc" } });

  console.log("\nSecuencias actuales:\n");
  for (const s of seqs) {
    const proximo = String(s.currentNumber + 1).padStart(s.padding || 4, "0");
    console.log(
      `  ${s.sequenceType.padEnd(22)} último=${String(s.currentNumber).padStart(6)}` +
        `   próximo=${s.prefix || ""}${proximo}`
    );
  }
  if (seqs.length === 0) console.log("  (no hay secuencias registradas)");
}

async function main() {
  const [tipo, valorCrudo] = process.argv.slice(2);

  if (!tipo) {
    await mostrarEstado();
    console.log(
      "\nPara alinear:  node scripts/fe-set-consecutivo.mjs <TIPO> <ÚLTIMO_EMITIDO>\n" +
        `Tipos válidos: ${TIPOS.join(", ")}\n`
    );
    return;
  }

  if (!TIPOS.includes(tipo)) {
    throw new Error(`Tipo inválido: "${tipo}". Válidos: ${TIPOS.join(", ")}`);
  }

  const ultimoEmitido = Number(valorCrudo);
  if (!Number.isInteger(ultimoEmitido) || ultimoEmitido < 0) {
    throw new Error(`El último emitido debe ser un entero >= 0, se recibió "${valorCrudo}".`);
  }

  const actual = await prisma.invoiceSequence.findUnique({ where: { sequenceType: tipo } });

  // Retroceder la secuencia reemitiría números ya usados: se bloquea salvo que
  // se pida explícitamente, porque casi siempre es un error de tipeo.
  if (actual && ultimoEmitido < actual.currentNumber && process.env.FORZAR !== "1") {
    throw new Error(
      `La secuencia de ${tipo} está en ${actual.currentNumber} y se pidió bajarla a ${ultimoEmitido}. ` +
        "Eso reemitiría números ya usados. Si es intencional, repetir con FORZAR=1."
    );
  }

  const guardada = await prisma.invoiceSequence.upsert({
    where: { sequenceType: tipo },
    update: { currentNumber: ultimoEmitido, year: new Date().getFullYear() },
    create: {
      sequenceType: tipo,
      currentNumber: ultimoEmitido,
      year: new Date().getFullYear(),
      prefix: "",
      padding: 4,
    },
  });

  const proximo = String(guardada.currentNumber + 1).padStart(guardada.padding || 4, "0");
  console.log(
    `\n${tipo}: ${actual ? actual.currentNumber : "(nueva)"} -> ${guardada.currentNumber}` +
      `\nLa próxima factura emitida será la ${guardada.prefix || ""}${proximo}.\n`
  );
}

main()
  .catch((error) => {
    console.error(`\nError: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
