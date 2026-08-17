"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  AUDIENCIAS,
  VERSION_CORPUS,
  alternativasParaAudiencia,
  buscarFrases,
  existeDia,
  fraseDeIndice,
  totalFrases,
} from "@/lib/frases";
import {
  frasesUsadas,
  seleccionesDelDia,
  verificacionDeFuentes,
} from "@/lib/frases-queries";

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
 *
 * Prohibición de repetir: una frase elegida alguna vez no se puede volver a
 * elegir, ni otro día ni para otra audiencia. La comprobación se hace acá y no
 * solo en la interfaz porque es la regla la que manda, no la pantalla: el panel
 * ya no la ofrece, pero un enlace viejo o dos pestañas abiertas sí podrían
 * mandarla. Se compara por texto —no por índice— porque regenerar el corpus
 * mueve las posiciones y lo quemado tiene que seguir quemado.
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

  // Cambiar de opinión sobre la misma casilla (fecha, audiencia) sigue valiendo:
  // lo que no vale es llevarse la frase a otra casilla.
  const yaUsada = await prisma.dailyPhrasePick.findFirst({
    where: {
      phraseText: frase.texto,
      status: { not: "SKIPPED" },
      NOT: { date, audience: audiencia },
    },
    select: { date: true, audience: true },
  });
  if (yaUsada) {
    return {
      error: `Esa frase ya se publicó el ${yaUsada.date} para ${yaUsada.audience}. No se repite ninguna: hay que elegir otra, o reabrir aquel día si querés liberarla.`,
    };
  }

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
 * Búsqueda manual en el corpus entero. Va como server action y no como datos
 * precargados: el corpus pesa 200 KB y no tiene por qué cruzar al navegador
 * entero para filtrar cuarenta resultados.
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
 * Propone otras frases del corpus para UNA audiencia de un día concreto.
 *
 * Es lo que hace el botón «sustituir por otras del corpus»: cambia las
 * candidatas que el corpus asignó a esa audiencia por otras que calzan con su
 * tono y con los temas del día. Nunca ofrece nada ya publicado —la prohibición
 * de repetir es absoluta, no una ventana de tantos días— salvo lo que esta misma
 * casilla (fecha, audiencia) tenga guardado, que es cambiar de opinión y no
 * repetir.
 *
 * `vistas` son las que el admin ya descartó en esta sesión: van excluidas para
 * que cada tanda traiga material nuevo.
 */
export async function otrasOpcionesParaAudiencia({ fecha, audiencia, vistas = [], pagina = 0, limite = 6 }) {
  requireAdmin(await getSession());

  const date = String(fecha || "");
  if (!existeDia(date)) return { error: "Esa fecha está fuera del calendario de frases." };
  if (!audiencia || !IDS_AUDIENCIA.has(audiencia)) {
    return { error: "Hay que indicar para cuál audiencia son las opciones." };
  }

  const { usadas } = await frasesUsadas();
  const delDia = await seleccionesDelDia(date);
  const propia = delDia.get(audiencia);
  if (propia && propia.status !== "SKIPPED" && propia.phraseIndex >= 0) {
    usadas.delete(propia.phraseIndex);
  }

  const { opciones, pagina: p, hayMas, elegibles } = alternativasParaAudiencia({
    fecha: date,
    audiencia,
    excluir: [...usadas, ...vistas.map(Number).filter(Number.isInteger)],
    limite: Math.min(Math.max(Number(limite) || 6, 1), 12),
    pagina: Number(pagina) || 0,
  });

  const verificadas = await verificacionDeFuentes(opciones.map((o) => o.claveFuente));
  return {
    opciones: opciones.map((o) => ({
      ...o,
      verificada: Boolean(verificadas.get(o.claveFuente)?.verified),
    })),
    pagina: p,
    hayMas,
    elegibles,
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
