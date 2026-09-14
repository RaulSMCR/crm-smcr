/**
 * Quita los comentarios HTML del markdown antes de renderizarlo.
 *
 * `react-markdown` no los ignora: los **escapa**. Un `<!-- bloque: riesgo -->`
 * en el cuerpo de un tema sale publicado como el texto literal
 * `<!-- bloque: riesgo -->` en medio de la página. Verificado con el renderer de
 * este proyecto, que corre sin `rehype-raw`.
 *
 * Se filtra al renderizar y no al importar, y la diferencia importa:
 *
 *   - los marcadores de bloque son **estructura**: `hub-markdown.js` los lee
 *     para el informe y los guarda en `metadata.bloques`, pero lo que la
 *     plantilla va a necesitar el día que los pinte como caja es *dónde* están,
 *     y eso solo vive en el cuerpo. Borrarlos al importar lo perdería sin vuelta;
 *   - filtrar al renderizar arregla además lo ya importado, sin migrar datos.
 *
 * Se quitan **todos** los comentarios, no solo los `bloque:`. Un comentario es
 * por definición una nota de quien escribe: `<!-- revisar esto -->` se filtraría
 * igual que un marcador, y dejar uno pasar sería la misma sorpresa.
 *
 * Lo que no se toca: los bloques de código cercados y el código en línea. Ahí un
 * `<!-- … -->` puede ser el contenido —un artículo que muestra cómo se escribe un
 * comentario— y quitarlo sería corromper el texto en vez de limpiarlo.
 */

/** Segmentos donde un comentario es contenido y no una nota: código cercado y en línea. */
const CODIGO = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/;

const COMENTARIO = /<!--[\s\S]*?-->/g;

/**
 * @param {string} texto cuerpo en markdown.
 * @returns {string} el mismo texto sin comentarios HTML. Si no había ninguno,
 *   devuelve la cadena original sin tocar: la función es un no-op verificable.
 */
export function quitarComentariosHtml(texto) {
  const fuente = String(texto ?? "");
  if (!fuente.includes("<!--")) return fuente;

  // `split` con grupo de captura devuelve los segmentos alternados: los impares
  // son el código, que pasa entero; los pares son prosa, que se limpia.
  const partes = fuente.split(new RegExp(CODIGO.source, "g"));
  let toco = false;

  const limpias = partes.map((parte, indice) => {
    if (indice % 2 === 1) return parte;
    if (!parte.includes("<!--")) return parte;
    toco = true;
    // Al sacar un comentario que estaba en su propia línea quedan dos saltos de
    // más. Markdown los ignora, pero el cuerpo guardado no cambió y este
    // colapso es solo de presentación, así que se hace únicamente donde se quitó
    // algo: sin comentarios, la salida es idéntica a la entrada.
    return parte.replace(COMENTARIO, "").replace(/\n{3,}/g, "\n\n");
  });

  return toco ? limpias.join("") : fuente;
}
