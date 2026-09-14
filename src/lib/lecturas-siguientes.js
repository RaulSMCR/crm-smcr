// src/lib/lecturas-siguientes.js
//
// Qué se le ofrece al lector cuando termina un artículo.
//
// El pie del artículo se armaba con una condición de todo o nada: si el
// artículo no tenía serie, ni tema, ni disciplina, el bloque entero devolvía
// `null` y la única salida que quedaba era «Volver a todos los artículos». Tres
// de los dieciocho artículos publicados estaban en ese caso, y no por descuido
// del componente sino porque la clasificación todavía no se había cargado: la
// navegación depende de datos que se cargan a mano, así que tiene que aguantar
// que falten.
//
// La regla que se fija acá es que un artículo publicado nunca termina en una
// pared. Si no hay tema del cual colgar recomendaciones, se ofrece lo más
// cercano que exista —otros textos de quien escribe, y si no alcanzan, los
// últimos publicados— y, cuando el artículo no pertenece a una serie, el par
// cronológico de la biblioteca.
//
// Lógica pura; las consultas viven en el componente.

/**
 * Completa la lista de sugerencias sin repetir.
 *
 * Se prefiere al mismo autor: quien terminó un ensayo suele querer otro de la
 * misma mano antes que el último publicado por cualquiera. Los recientes
 * rellenan lo que falte para que el bloque nunca salga con una sola tarjeta
 * suelta.
 *
 * @param {Array<{id: string}>} delAutor
 * @param {Array<{id: string}>} recientes
 * @param {{ limite?: number, excluir?: string[] }} [opciones]
 */
export function completarSugerencias(delAutor = [], recientes = [], opciones = {}) {
  const { limite = 3, excluir = [] } = opciones;
  const vistos = new Set(excluir.filter(Boolean));
  const salida = [];

  for (const lista of [delAutor, recientes]) {
    for (const post of lista || []) {
      if (!post?.id || vistos.has(post.id)) continue;
      vistos.add(post.id);
      salida.push(post);
      if (salida.length >= limite) return salida;
    }
  }
  return salida;
}

/**
 * Qué bloques corresponden al pie de este artículo.
 *
 * `cronologia` solo cuenta cuando el artículo no pertenece a una serie: el que
 * está en una serie ya tiene su anterior y su siguiente, y dos pares de flechas
 * con sentidos distintos —el orden de la serie y el de la fecha— en el mismo
 * pie es una forma de no decir nada.
 */
export function bloquesDeLectura(datos = {}) {
  const serie = Boolean(datos.series);
  return {
    serie,
    cronologia: !serie && Boolean(datos.cronologia?.anterior || datos.cronologia?.siguiente),
    etiquetas: Boolean(datos.topics?.length || datos.disciplines?.length),
    complementarios: Boolean(datos.complementary?.length),
    delMismoTema: Boolean(datos.clusterPosts?.length),
    sugerencias: Boolean(datos.sugerencias?.length),
  };
}

/**
 * ¿Le queda al lector algún camino además de volver al listado?
 *
 * Las etiquetas solas no cuentan como camino de lectura: llevan a una
 * biblioteca filtrada, no a un texto. Lo que se exige es que haya al menos un
 * artículo concreto al que ir.
 */
export function ofreceLectura(bloques = {}) {
  return Boolean(bloques.serie || bloques.cronologia || bloques.delMismoTema || bloques.sugerencias);
}
