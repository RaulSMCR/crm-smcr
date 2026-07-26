"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  AUDIENCIAS,
  VERSION_CORPUS,
  buscarFrases,
  existeDia,
  fraseDeIndice,
  totalFrases,
} from "@/lib/frases";
import { verificacionDeFuentes } from "@/lib/frases-queries";

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

function revalidarFrases() {
  revalidatePath("/panel/admin/frases");
  revalidatePath("/panel/admin/tareas");
  revalidatePath("/panel/admin");
}

const IDS_AUDIENCIA = new Set(AUDIENCIAS.map((a) => a.id));

/**
 * Elige la frase de una audiencia concreta para un día. `audiencia` es
 * obligatoria: las 8 audiencias deciden por separado, y la clave de guardado es
 * (fecha, audiencia) — no la fecha sola, que pisaría las otras 7 elecciones del
 * mismo día.
 *
 * Se guarda una copia del texto, el autor y la obra además del índice. Es
 * deliberado: lo que se publicó tiene que poder reconstruirse aunque el corpus
 * se regenere y los índices se muevan.
 */
export async function elegirFraseDelDia({ fecha, indice, audiencia, slot, nota, sustituida }) {
  const session = await getSession();
  requireAdmin(session);

  const date = String(fecha || "");
  if (!existeDia(date)) {
    return { error: "Esa fecha está fuera del calendario de frases." };
  }

  if (!audiencia || !IDS_AUDIENCIA.has(audiencia)) {
    return { error: "Hay que indicar para cuál audiencia es esta frase." };
  }

  const i = Number(indice);
  if (!Number.isInteger(i) || i < 0 || i >= totalFrases()) {
    return { error: "Frase inexistente." };
  }
  const frase = fraseDeIndice(i);
  const slotLimpio = slot === 1 || slot === 2 ? slot : null;

  const datos = {
    phraseIndex: i,
    phraseText: frase.texto,
    author: frase.autor,
    work: frase.obra,
    sourceKey: frase.claveFuente,
    corpusVersion: VERSION_CORPUS,
    slot: slotLimpio,
    status: sustituida || !slotLimpio ? "SUBSTITUTED" : "APPROVED",
    note: nota ? String(nota).slice(0, 2000) : null,
    decidedBy: String(session.sub),
  };

  await prisma.dailyPhrasePick.upsert({
    where: { date_audience: { date, audience: audiencia } },
    create: { date, audience: audiencia, ...datos },
    update: datos,
  });

  revalidarFrases();
  return { success: true };
}

/**
 * Busca en las 1.112 frases del corpus para sustituir la candidata de un día.
 * Va como server action y no como datos precargados: el corpus pesa 200 KB y no
 * tiene por qué cruzar al navegador entero para filtrar cuarenta resultados.
 */
export async function buscarEnCorpus(filtros = {}) {
  requireAdmin(await getSession());

  const resultados = buscarFrases({
    texto: String(filtros.texto || "").slice(0, 120),
    autor: String(filtros.autor || "").slice(0, 120),
    tema: String(filtros.tema || "").slice(0, 40),
    categoria: String(filtros.categoria || "").slice(0, 40),
    largoMaximo: Number(filtros.largoMaximo) || 0,
    limite: 40,
  });

  const verificadas = await verificacionDeFuentes(resultados.map((r) => r.claveFuente));
  return {
    resultados: resultados.map((r) => ({
      ...r,
      verificada: Boolean(verificadas.get(r.claveFuente)?.verified),
    })),
  };
}

/**
 * Marca un día sin publicación. Si `audiencia` viene, omite solo esa audiencia;
 * si no viene, omite las 8 (el botón "no publicar nada hoy").
 */
export async function omitirDia({ fecha, audiencia, nota }) {
  const session = await getSession();
  requireAdmin(session);

  const date = String(fecha || "");
  if (!existeDia(date)) return { error: "Esa fecha está fuera del calendario de frases." };

  const audiencias = audiencia && IDS_AUDIENCIA.has(audiencia) ? [audiencia] : AUDIENCIAS.map((a) => a.id);

  const datos = {
    phraseIndex: -1,
    phraseText: "",
    author: "",
    work: "",
    sourceKey: "",
    corpusVersion: VERSION_CORPUS,
    slot: null,
    status: "SKIPPED",
    note: nota ? String(nota).slice(0, 2000) : null,
    decidedBy: String(session.sub),
  };

  // Secuencial y no Promise.all: el pool de Supabase es de una sola conexión
  // (connection_limit=1) y las escrituras en paralelo expiran con P2024.
  for (const aud of audiencias) {
    await prisma.dailyPhrasePick.upsert({
      where: { date_audience: { date, audience: aud } },
      create: { date, audience: aud, ...datos },
      update: datos,
    });
  }

  revalidarFrases();
  return { success: true };
}

/**
 * Deshace la decisión de un día para volver a revisarlo. Si `audiencia` viene,
 * reabre solo esa; si no, reabre las 8 (equivalente a empezar el día de cero).
 */
export async function reabrirDia(fecha, audiencia) {
  requireAdmin(await getSession());
  const date = String(fecha || "");
  const where =
    audiencia && IDS_AUDIENCIA.has(audiencia) ? { date, audience: audiencia } : { date };
  await prisma.dailyPhrasePick.deleteMany({ where });
  revalidarFrases();
  return { success: true };
}

/**
 * Verificación de una fuente contra la edición. Es el candado del Anexo A: sin
 * fuente verificada no se genera placa para redes, porque una cita mal
 * atribuida en una plataforma de salud mental es barata de evitar y cara de
 * reparar.
 */
export async function marcarFuenteVerificada({ clave, autor, obra, verificada, nota }) {
  const session = await getSession();
  requireAdmin(session);

  const sourceKey = String(clave || "").trim();
  if (!sourceKey) return { error: "Fuente inválida." };

  const verified = Boolean(verificada);
  const datos = {
    author: String(autor || "").slice(0, 300),
    work: String(obra || "").slice(0, 500),
    verified,
    note: nota ? String(nota).slice(0, 2000) : null,
    verifiedBy: verified ? String(session.sub) : null,
    verifiedAt: verified ? new Date() : null,
  };

  await prisma.phraseSourceCheck.upsert({
    where: { sourceKey },
    create: { sourceKey, ...datos },
    update: datos,
  });

  revalidarFrases();
  return { success: true };
}
