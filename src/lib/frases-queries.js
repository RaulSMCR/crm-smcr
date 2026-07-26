// src/lib/frases-queries.js
//
// Estado persistido de la frase diaria. El corpus es estático (frases.js); aquí
// solo vive lo que cambia: la elección del admin y la verificación de fuentes.
//
// Cada una de las 8 audiencias decide su propia frase el mismo día: la unidad
// de persistencia es (fecha, audiencia), no la fecha sola. Un día queda
// "resuelto" solo cuando las 8 audiencias tienen pick.
//
// Consultas secuenciales: el pool es de una sola conexión (connection_limit=1) y
// las paralelas se pisan y expiran con P2024.

import { prisma } from "@/lib/prisma";
import {
  AUDIENCIAS,
  PRIMER_DIA,
  ULTIMO_DIA,
  diaDeFrases,
  fechaHoy,
  fraseDeIndice,
  fuentesPorImpacto,
  reconciliarIndice,
  sesionDelDia,
} from "@/lib/frases";

/**
 * Devuelve la elección con su índice al día de hoy. El texto guardado manda
 * sobre el índice: si el corpus se regeneró y las posiciones se movieron, el
 * índice se recupera por texto. Ver `reconciliarIndice`.
 */
export function reconciliarSeleccion(pick) {
  if (!pick) return null;
  const { phraseIndex, desfasada, huerfana } = reconciliarIndice(pick);
  return { ...pick, phraseIndex, indiceDesfasado: desfasada, fraseHuerfana: huerfana };
}

const TOTAL_AUDIENCIAS = AUDIENCIAS.length;

/** Las hasta-8 elecciones de una fecha, indexadas por audiencia. */
export async function seleccionesDelDia(fecha) {
  const filas = await prisma.dailyPhrasePick.findMany({ where: { date: String(fecha) } });
  return new Map(filas.map((f) => [f.audience, reconciliarSeleccion(f)]));
}

/** Elecciones de un rango cerrado, agrupadas por fecha y luego por audiencia. */
export async function seleccionesEnRango(desde, hasta) {
  const filas = await prisma.dailyPhrasePick.findMany({
    where: { date: { gte: String(desde), lte: String(hasta) } },
    orderBy: [{ date: "asc" }, { audience: "asc" }],
  });
  const porFecha = new Map();
  for (const fila of filas) {
    if (!porFecha.has(fila.date)) porFecha.set(fila.date, new Map());
    porFecha.get(fila.date).set(fila.audience, reconciliarSeleccion(fila));
  }
  return porFecha;
}

/**
 * Cuántas audiencias tienen pick por fecha, en un rango. Es la base para saber
 * qué día está completo (8/8), a medio decidir, o intacto.
 */
export async function conteoPorFecha(desde, hasta) {
  const filas = await prisma.dailyPhrasePick.groupBy({
    by: ["date"],
    where: { date: { gte: String(desde), lte: String(hasta) } },
    _count: { _all: true },
  });
  return new Map(filas.map((f) => [f.date, f._count._all]));
}

/**
 * Fechas completamente resueltas (las 8 audiencias con pick) en un rango. Es lo
 * que consume `sesionDelDia`: mientras falte una audiencia, el día sigue
 * pendiente.
 */
export async function fechasResueltas(desde, hasta) {
  const conteo = await conteoPorFecha(desde, hasta);
  return new Set([...conteo.entries()].filter(([, n]) => n >= TOTAL_AUDIENCIAS).map(([f]) => f));
}

/**
 * Estado de verificación de un conjunto de fuentes. Las que nunca se tocaron no
 * tienen fila: se reportan como no verificadas, que es lo correcto por defecto.
 */
export async function verificacionDeFuentes(claves) {
  const unicas = [...new Set((claves || []).filter(Boolean))];
  if (unicas.length === 0) return new Map();
  const filas = await prisma.phraseSourceCheck.findMany({
    where: { sourceKey: { in: unicas } },
    select: { sourceKey: true, verified: true, note: true, verifiedAt: true },
  });
  return new Map(filas.map((f) => [f.sourceKey, f]));
}

/** ¿Se puede generar la placa de redes con esta frase? */
export function fuenteVerificada(claveFuente, verificaciones) {
  return Boolean(verificaciones.get(claveFuente)?.verified);
}

/**
 * Las 486 fuentes con su estado, ordenadas por impacto: verificar las primeras
 * 60 cubre más de la mitad de las publicaciones del año.
 */
export async function listaDeVerificacion({ soloPendientes = false, limite = 0 } = {}) {
  const fuentes = fuentesPorImpacto();
  const filas = await prisma.phraseSourceCheck.findMany({
    select: { sourceKey: true, verified: true, note: true, verifiedAt: true },
  });
  const estado = new Map(filas.map((f) => [f.sourceKey, f]));

  let lista = fuentes.map((f) => ({
    ...f,
    verificada: Boolean(estado.get(f.clave)?.verified),
    nota: estado.get(f.clave)?.note || null,
    verificadaEl: estado.get(f.clave)?.verifiedAt || null,
  }));

  if (soloPendientes) lista = lista.filter((f) => !f.verificada);
  if (limite) lista = lista.slice(0, limite);

  return {
    lista,
    total: fuentes.length,
    verificadas: fuentes.filter((f) => estado.get(f.clave)?.verified).length,
  };
}

/**
 * Arma la sesión de revisión completa: qué días hay que decidir, sus 16
 * candidatas resueltas, las elecciones ya guardadas por audiencia y el estado
 * de verificación de las fuentes implicadas.
 *
 * Devuelve datos planos y serializables, listos para cruzar a un componente
 * cliente sin arrastrar el corpus al navegador.
 */
export async function prepararSesion(fecha = fechaHoy(), horizonte = 7) {
  const hasta = sumarISO(fecha, horizonte);
  const resueltas = await fechasResueltas(fecha, hasta);
  const sesion = sesionDelDia(fecha, resueltas, horizonte);

  const seleccionesRango = await seleccionesEnRango(fecha, hasta);

  const pendientes = sesion.pendientes.map((p) => {
    const dia = diaDeFrases(p.fecha);
    const porAudiencia = seleccionesRango.get(p.fecha) || new Map();
    return {
      ...p,
      candidatas: dia ? dia.candidatas : [],
      // Objeto plano (no Map): tiene que cruzar a un componente cliente.
      selecciones: Object.fromEntries(porAudiencia),
      decididas: porAudiencia.size,
      totalAudiencias: TOTAL_AUDIENCIAS,
    };
  });

  const claves = pendientes.flatMap((p) => p.candidatas.map((c) => c.claveFuente));
  const verificadas = await verificacionDeFuentes(claves);

  // La ventana del corpus va del 15-ago-2026 al 14-ago-2027. Fuera de ella no
  // hay nada que decidir, y el panel tiene que decir por qué en vez de mostrar
  // un vacío mudo.
  const antesDeEmpezar = fecha < PRIMER_DIA;
  const despuesDelFinal = fecha > ULTIMO_DIA;

  return {
    sesion: {
      ...sesion,
      pendientes,
      antesDeEmpezar,
      despuesDelFinal,
      primerDia: PRIMER_DIA,
      ultimoDia: ULTIMO_DIA,
    },
    // Objeto plano en vez de Map: los Map no cruzan la frontera servidor-cliente.
    verificaciones: Object.fromEntries(
      [...verificadas.entries()].map(([k, v]) => [k, v.verified]),
    ),
  };
}

function sumarISO(iso, dias) {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d, 12));
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/** Historial reciente, para la página de control. */
export async function historialDeSelecciones(limite = 30) {
  const filas = await prisma.dailyPhrasePick.findMany({
    orderBy: [{ date: "desc" }, { audience: "asc" }],
    take: limite,
  });
  return filas.map((f) => ({
    ...f,
    frase: f.status === "SKIPPED" ? null : fraseDeIndice(f.phraseIndex),
  }));
}
