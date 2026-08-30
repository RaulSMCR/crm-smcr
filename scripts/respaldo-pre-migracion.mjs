// scripts/respaldo-pre-migracion.mjs
//
// Fotografía de la base justo antes de aplicar migraciones, y verificación de
// que después sigue estando todo.
//
//   node scripts/respaldo-pre-migracion.mjs           → toma la foto y la guarda
//   node scripts/respaldo-pre-migracion.mjs --check   → compara contra la última
//
// Existe por el 2026-08-19: `prisma migrate dev` contra producción vació la
// base. `migrate deploy` no hace eso, pero la diferencia entre los dos comandos
// no es algo que deba sostenerse solo en la memoria de quien los escribe. Contar
// antes y después cuesta treinta segundos y convierte "no debería haber pasado
// nada" en "no pasó nada".
//
// Solo lee. No escribe en la base.
//
// El volcado va a docs/backups/, que está fuera de git: lleva nombres, correos y
// cédulas reales. No se guardan hashes de contraseña ni de tokens: restaurar un
// artículo no requiere poder entrar como nadie.

import "dotenv/config";
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DIR = "docs/backups";

/**
 * Todo lo que no se puede perder, con lo que haría falta para reponerlo.
 * `modelo` es como lo llama Prisma; `tabla`, como lo llama Postgres.
 */
const TABLAS = [
  { modelo: "user", tabla: "User" },
  { modelo: "professionalProfile", tabla: "ProfessionalProfile" },
  { modelo: "post", tabla: "Post" },
  { modelo: "appointment", tabla: "Appointment" },
  { modelo: "service", tabla: "Service" },
  { modelo: "practiceLocation", tabla: "PracticeLocation" },
  { modelo: "professionalRate", tabla: "ProfessionalRate" },
  { modelo: "invoice", tabla: "Invoice" },
  { modelo: "invoiceLine", tabla: "InvoiceLine" },
  { modelo: "paymentTransaction", tabla: "PaymentTransaction" },
  { modelo: "caso", tabla: "Caso" },
  { modelo: "casoNota", tabla: "CasoNota" },
  { modelo: "series", tabla: "Series" },
  { modelo: "discipline", tabla: "Discipline" },
  { modelo: "topic", tabla: "Topic" },
  { modelo: "postDiscipline", tabla: "PostDiscipline" },
  { modelo: "postTopic", tabla: "PostTopic" },
];

/** Columnas que no salen de la base ni para un respaldo. */
const OMITIR = new Set([
  "passwordHash",
  "verifyTokenHash",
  "resetTokenHash",
  "googleRefreshToken",
]);

function limpiar(fila) {
  const salida = {};
  for (const [clave, valor] of Object.entries(fila)) {
    if (OMITIR.has(clave)) continue;
    salida[clave] = typeof valor === "bigint" ? String(valor) : valor;
  }
  return salida;
}

async function contar() {
  const conteos = {};
  for (const { modelo } of TABLAS) {
    conteos[modelo] = await prisma[modelo].count();
  }
  return conteos;
}

function ultimoRespaldo() {
  const archivos = readdirSync(DIR)
    .filter((nombre) => nombre.startsWith("pre-migracion-") && nombre.endsWith(".json"))
    .sort();
  if (!archivos.length) return null;
  return JSON.parse(readFileSync(`${DIR}/${archivos.at(-1)}`, "utf8"));
}

async function verificar() {
  const previo = ultimoRespaldo();
  if (!previo) {
    console.error("No hay respaldo previo con el que comparar.");
    process.exitCode = 1;
    return;
  }

  const ahora = await contar();
  let perdidas = 0;

  console.log(`Comparando contra ${previo.tomadoEn}\n`);
  for (const { modelo } of TABLAS) {
    const antes = previo.conteos[modelo] ?? 0;
    const despues = ahora[modelo] ?? 0;
    const delta = despues - antes;
    const marca = delta < 0 ? "PERDIDA" : delta > 0 ? "+" : "ok";
    if (delta < 0) perdidas += 1;
    console.log(
      `${marca.padEnd(8)} ${modelo.padEnd(22)} ${String(antes).padStart(6)} → ${String(despues).padStart(6)}${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}`,
    );
  }

  if (perdidas) {
    console.error(`\n${perdidas} tabla(s) con menos filas que antes. NO continuar.`);
    process.exitCode = 1;
  } else {
    console.log("\nNinguna tabla perdió filas.");
  }
}

async function respaldar() {
  mkdirSync(DIR, { recursive: true });
  const fecha = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const conteos = await contar();
  const datos = {};
  for (const { modelo, tabla } of TABLAS) {
    // SELECT * y no findMany(): el cliente de Prisma ya conoce las columnas que
    // la migración va a crear y pide por nombre las que todavía no existen. Un
    // respaldo tiene que poder leer la base tal como está, no como va a quedar.
    const filas = await prisma.$queryRawUnsafe(`SELECT * FROM "${tabla}"`);
    datos[modelo] = filas.map(limpiar);
  }

  const salida = { tomadoEn: new Date().toISOString(), conteos, datos };
  const ruta = `${DIR}/pre-migracion-${fecha}.json`;
  writeFileSync(ruta, JSON.stringify(salida, null, 2), "utf8");

  console.log(`Respaldo en ${ruta}\n`);
  for (const { modelo } of TABLAS) {
    console.log(`  ${modelo.padEnd(22)} ${conteos[modelo]}`);
  }
}

const main = process.argv.includes("--check") ? verificar : respaldar;
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
