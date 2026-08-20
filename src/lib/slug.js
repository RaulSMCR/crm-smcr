// src/lib/slug.js
//
// Una sola forma de convertir un título en slug, para todo el proyecto.
//
// Antes había siete implementaciones. Cuatro de ellas hacían `.toLowerCase()` y
// después `.replace(/[^a-z0-9]+/g, "-")` **sin normalizar los acentos primero**,
// así que cada letra acentuada se convertía en un guión:
//
//   "Qué es psicoterapia"  ->  "qu-es-psicoterapia"
//   "Lógicas comunes"      ->  "l-gicas-comunes"
//
// Siete artículos publicados quedaron con la URL mutilada de esa manera. El
// arreglo no es cosmético: `é` tiene que transliterarse a `e`, no desaparecer.
//
// La otra consecuencia de tener siete copias es que el preview del editor y el
// valor que se graba salían de implementaciones distintas: el creador de admin
// mostraba el slug correcto y la API guardaba el mutilado.

const MAX_POR_DEFECTO = 80;

/**
 * Convierte un texto en slug.
 *
 * @param {string} value
 * @param {object} [opciones]
 * @param {string} [opciones.separator="-"]  separador entre palabras
 * @param {number} [opciones.maxLength=80]   largo máximo, recortando por separador
 */
export function slugify(value, { separator = "-", maxLength = MAX_POR_DEFECTO } = {}) {
  const sep = String(separator || "-");

  const base = String(value ?? "")
    // NFD descompone "é" en "e" + acento combinante; el replace siguiente se
    // lleva el acento y deja la letra. Sin este paso, la letra entera cae en
    // `[^a-z0-9]` y se pierde. Es el orden lo que importa: normalizar primero.
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // La ñ no es un carácter con diacrítico combinante en todas las fuentes de
    // texto, así que se trata aparte. Lo mismo la ç.
    .replace(/ñ/gi, "n")
    .replace(/ç/gi, "c")
    .toLowerCase()
    .trim();

  const conSeparador = base
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, "g"), "");

  if (!maxLength || conSeparador.length <= maxLength) return conSeparador;

  // Recortar por el separador y no a ciegas: un slug que termina en media
  // palabra es peor que uno un poco más corto.
  const recortado = conSeparador.slice(0, maxLength);
  const ultimo = recortado.lastIndexOf(sep);
  return (ultimo > maxLength * 0.6 ? recortado.slice(0, ultimo) : recortado).replace(
    new RegExp(`\\${sep}+$`, "g"),
    "",
  );
}

/**
 * Slug único, resolviendo colisiones con un sufijo incremental: `-2`, `-3`.
 *
 * Antes se usaba `Math.random().toString(36).slice(2, 7)`, que produce cosas
 * como `la-salud-mental-no-cabe-en-una-sola-disciplina-8oyy6` —hay un artículo
 * publicado con esa URL—. Un sufijo aleatorio no es reproducible: correr la
 * misma migración dos veces da resultados distintos, y el slug no se puede
 * predecir ni verificar. El incremental sí.
 *
 * @param {string} base            texto del que sale el slug
 * @param {(slug: string) => Promise<boolean>} estaTomado  consulta de existencia
 * @param {object} [opciones]      se pasan a `slugify`
 * @param {string} [opciones.fallback="articulo"]  si el texto no deja nada usable
 */
export async function slugUnico(base, estaTomado, opciones = {}) {
  const { fallback = "articulo", ...resto } = opciones;
  const raiz = slugify(base, resto) || fallback;

  let candidato = raiz;
  let i = 2;
  while (await estaTomado(candidato)) {
    candidato = `${raiz}-${i}`;
    i += 1;
  }
  return candidato;
}
