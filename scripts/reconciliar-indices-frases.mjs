// scripts/reconciliar-indices-frases.mjs
//
// Repara los índices de las elecciones guardadas después de regenerar el corpus.
//
// El corpus se ordena alfabéticamente, así que incorporar autores desplaza las
// posiciones y un `phraseIndex` guardado puede quedar apuntando a otra frase. La
// elección guarda una copia del texto justamente para esto: el texto manda y el
// índice se recalcula.
//
// La aplicación ya reconcilia en memoria al leer (ver `reconciliarIndice`), así
// que esto no es obligatorio para que el panel funcione; sirve para dejar la
// base coherente y que las consultas por índice no mientan.
//
// Uso:
//   node scripts/reconciliar-indices-frases.mjs           (muestra qué haría)
//   node scripts/reconciliar-indices-frases.mjs --aplicar (escribe)

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");

const corpus = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/data/frases/corpus.json"), "utf8"),
);
const indicePorTexto = new Map(corpus.frases.map((f, i) => [f.t, i]));

async function run() {
  const picks = await prisma.dailyPhrasePick.findMany({
    where: { status: { not: "SKIPPED" } },
    orderBy: [{ date: "asc" }, { audience: "asc" }],
  });

  let correctas = 0;
  const desfasadas = [];
  const huerfanas = [];

  for (const pick of picks) {
    const actual = corpus.frases[pick.phraseIndex];
    if (actual && actual.t === pick.phraseText) {
      correctas += 1;
      continue;
    }
    const nuevo = indicePorTexto.get(pick.phraseText);
    if (nuevo === undefined) huerfanas.push(pick);
    else desfasadas.push({ pick, nuevo });
  }

  console.log(`elecciones revisadas: ${picks.length}`);
  console.log(`  índice correcto:  ${correctas}`);
  console.log(`  desfasadas:       ${desfasadas.length}`);
  console.log(`  huérfanas:        ${huerfanas.length}`);

  for (const { pick, nuevo } of desfasadas) {
    console.log(`  ${pick.date}/${pick.audience}: ${pick.phraseIndex} → ${nuevo}  (${pick.author})`);
  }
  for (const pick of huerfanas) {
    console.log(`  ${pick.date}/${pick.audience}: la frase ya no está en el corpus (${pick.author})`);
    console.log(`      se conserva el texto guardado; conviene reelegir esa audiencia.`);
  }

  if (!aplicar) {
    console.log("\nSimulación. Volvé a correrlo con --aplicar para escribir.");
    return;
  }

  // Secuencial: el pool es de una sola conexión (connection_limit=1).
  for (const { pick, nuevo } of desfasadas) {
    await prisma.dailyPhrasePick.update({
      where: { id: pick.id },
      data: { phraseIndex: nuevo, corpusVersion: corpus.version },
    });
  }
  console.log(`\n${desfasadas.length} índices actualizados.`);
}

run()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
