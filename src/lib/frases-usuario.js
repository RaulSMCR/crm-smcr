// src/lib/frases-usuario.js
//
// Qué frase ve un usuario registrado. Módulo de SERVIDOR: toca el corpus
// (300 KB) y la base de datos.
//
// La cadena de resolución tiene tres eslabones, y el orden importa:
//
//   1. Elección del admin para (fecha, audiencia). Es la curaduría humana y
//      manda sobre todo lo demás.
//   2. Si el admin no decidió, el ancla que el corpus ya tenía asignada a esa
//      audiencia ese día. El corpus es una asignación completa de 5.840 piezas,
//      no un catálogo suelto: la app funciona desde el día uno aunque nadie
//      haya curado nada.
//   3. Si la fecha está fuera de la ventana del corpus, no hay frase. El
//      llamador decide si oculta la tarjeta o cae al placeholder heredado.
//
// Si el admin marcó SKIPPED para esa audiencia, se devuelve null a propósito:
// "no publicar" es una decisión, no un hueco que haya que rellenar.

import { prisma } from "@/lib/prisma";
import { diaDeFrases, fechaVigente } from "@/lib/frases";
import { audienciaDeUsuario } from "@/lib/frases-audiencia";

/**
 * Motivos por los que puede no haber frase. Se distinguen a propósito: "el
 * admin decidió no publicar" y "el corpus no cubre esta fecha" piden
 * comportamientos opuestos en la interfaz, y colapsarlos en un null suelto
 * llevaba a ocultar la tarjeta cuando en realidad tocaba el placeholder.
 */
export const SIN_FRASE = {
  OMITIDA: "OMITIDA", // el admin marcó SKIPPED: no mostrar nada
  FUERA_DE_VENTANA: "FUERA_DE_VENTANA", // el corpus no cubre la fecha: cae al placeholder
  SIN_USUARIO: "SIN_USUARIO",
};

/**
 * Frase vigente para un usuario. La fecha por defecto respeta el corte de las
 * 6:00 de Costa Rica: antes de esa hora sigue publicada la de ayer.
 *
 * @param {{id: string, gender?: string|null, birthDate?: Date|string|null}} usuario
 * @returns {Promise<{frase: object|null, motivo: string|null}>}
 */
export async function fraseParaUsuario(usuario, fecha = fechaVigente()) {
  if (!usuario?.id) return { frase: null, motivo: SIN_FRASE.SIN_USUARIO };

  const dia = diaDeFrases(fecha);
  if (!dia) return { frase: null, motivo: SIN_FRASE.FUERA_DE_VENTANA };

  const { audiencia, derivada } = audienciaDeUsuario(usuario);

  const pick = await prisma.dailyPhrasePick.findUnique({
    where: { date_audience: { date: fecha, audience: audiencia } },
  });

  if (pick?.status === "SKIPPED") return { frase: null, motivo: SIN_FRASE.OMITIDA };

  const base = {
    fecha,
    audiencia,
    audienciaDerivada: derivada,
    evento: dia.evento,
    ventanaSensible: dia.ventanaSensible,
  };

  if (pick) {
    return {
      frase: {
        ...base,
        texto: pick.phraseText,
        autor: pick.author,
        obra: pick.work,
        curada: true,
      },
      motivo: null,
    };
  }

  // Sin curaduría: el ancla que el corpus asignó a esta audiencia (slot 1).
  const ancla =
    dia.candidatas.find((c) => c.audiencia === audiencia && c.slot === 1) ||
    dia.candidatas.find((c) => c.audiencia === audiencia);
  if (!ancla) return { frase: null, motivo: SIN_FRASE.FUERA_DE_VENTANA };

  return {
    frase: {
      ...base,
      texto: ancla.texto,
      autor: ancla.autor,
      obra: ancla.obra,
      curada: false,
    },
    motivo: null,
  };
}

/**
 * Resuelve la frase que toca mostrar, con el placeholder heredado como red de
 * seguridad. Devuelve null solo cuando el admin decidió no publicar.
 *
 * @param {function} placeholder función que devuelve la frase heredada
 */
export async function fraseAMostrar(usuario, placeholder, fecha = fechaVigente()) {
  const { frase, motivo } = await fraseParaUsuario(usuario, fecha);
  if (frase) return frase;
  if (motivo === SIN_FRASE.OMITIDA) return null;
  return placeholder();
}

/**
 * Resuelve la frase de muchos usuarios de una vez, para el envío push. Hace una
 * sola consulta de picks en lugar de una por persona.
 *
 * @param {Array<{id, gender, birthDate}>} usuarios
 * @returns {Promise<Map<string, {texto, autor, audiencia}>>} indexado por userId
 */
export async function frasesParaUsuarios(usuarios, fecha = fechaVigente()) {
  const resultado = new Map();
  const dia = diaDeFrases(fecha);
  if (!dia || !usuarios?.length) return resultado;

  const picks = await prisma.dailyPhrasePick.findMany({ where: { date: fecha } });
  const porAudiencia = new Map(picks.map((p) => [p.audience, p]));

  for (const usuario of usuarios) {
    const { audiencia } = audienciaDeUsuario(usuario);
    const pick = porAudiencia.get(audiencia);

    if (pick?.status === "SKIPPED") continue;

    if (pick) {
      resultado.set(usuario.id, {
        texto: pick.phraseText,
        autor: pick.author,
        audiencia,
        curada: true,
      });
      continue;
    }

    const ancla =
      dia.candidatas.find((c) => c.audiencia === audiencia && c.slot === 1) ||
      dia.candidatas.find((c) => c.audiencia === audiencia);
    if (!ancla) continue;

    resultado.set(usuario.id, {
      texto: ancla.texto,
      autor: ancla.autor,
      audiencia,
      curada: false,
    });
  }

  return resultado;
}
