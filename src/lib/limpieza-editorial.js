// src/lib/limpieza-editorial.js
//
// Separa el artículo del andamiaje con que se produce.
//
// Un documento que sale de la matriz editorial trae dos cosas mezcladas: el
// ensayo, que se publica, y las instrucciones de producción, que son para quien
// lo prepara. Hasta ahora todo eso caía junto en el campo «Contenido» y había
// que borrarlo a mano cada vez.
//
// Qué se quita, y por qué cada cosa no es artículo:
//
//   • La línea de cabecera (`**Fase 5 · Artículo 1** · *La angustia y sus
//     formas*`). Ya se leyó como fase, serie y entrega: dejarla en el cuerpo la
//     repite en la página.
//   • El plan de cortes (`Extensión total: ~4.900 palabras. Corte en 3 partes.`
//     y las líneas `**Parte 1: "…"** — desde … hasta …`). Es la instrucción de
//     cómo trocear el texto, no el texto.
//   • Las marcas `## PARTE 1`, `## PARTE 2`… Señalan dónde cortar; no son
//     secciones del ensayo. Los títulos reales del artículo son los `###`.
//   • Los puentes (`**Puente:** En la entrega anterior…`). Están escritos para
//     quien lee la entrega 2 después de la 1. Si se publican juntas, el puente
//     le habla al lector de una entrega anterior que tiene arriba.
//   • Los bloques `### Referencias del segmento (APA)`, **y solo si el documento
//     trae además unas referencias generales**, que son su unión. Sin esa
//     condición no se tocan: quitar la bibliografía de un ensayo porque parecía
//     repetida sería exactamente el error que este archivo intenta evitar.
//
// Qué se conserva, siempre: el cuerpo, todos sus títulos de sección y la
// bibliografía final. La bibliografía es parte del artículo, no andamiaje.
//
// Nada se quita en silencio: `removidos` lista lo sacado para que la pantalla
// de importación lo diga. Un limpiador que borra sin avisar es peor que uno que
// no limpia.

const RE_CABECERA_FASE = /^\s*[*_]*\s*fase\s+[^\n]*[·|][^\n]*$/i;
const RE_EXTENSION = /^\s*[*_]*\s*extensi[óo]n\s+total\s*:/i;
const RE_CORTE = /corte\s+en\s+\d+\s+partes?/i;
const RE_PLAN_DE_PARTE = /^\s*[*_]{1,2}\s*parte\s+\d+\s*[:.]/i;
const RE_MARCA_DE_PARTE = /^#{1,6}\s*parte\s+\d+\s*$/i;
const RE_PUENTE = /^\s*[*_]{1,2}\s*puente\s*[*_]{0,2}\s*:/i;
const RE_REFERENCIAS_SEGMENTO = /^#{1,6}\s*referencias\s+del\s+segmento\b/i;
const RE_REFERENCIAS_GENERALES = /^#{1,6}\s*referencias\s+(generales|del\s+art[íi]culo)\b/im;
const RE_SEPARADOR = /^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/;

function esVacia(linea) {
  return !String(linea).trim();
}

/**
 * @param {string} texto  cuerpo del documento, ya sin el H1 ni el bloque de metadatos
 * @returns {{ contenido: string, removidos: string[] }}
 */
export function limpiarAndamiajeEditorial(texto) {
  const lineas = String(texto || "").replace(/\r\n/g, "\n").split("\n");
  const hayReferenciasGenerales = RE_REFERENCIAS_GENERALES.test(texto);

  const salida = [];
  const cuenta = { cabecera: 0, plan: 0, marcas: 0, puentes: 0, referencias: 0 };

  // La cabecera vive antes del primer título o separador. Después de ese punto,
  // una línea que empiece con "Parte 3:" ya es prosa del ensayo y no se toca.
  let enCabecera = true;
  // Nivel del encabezado cuya sección se está descartando, o null.
  let saltando = null;
  let enPuente = false;

  for (const linea of lineas) {
    const encabezado = linea.match(/^(#{1,6})\s+\S/);
    const nivel = encabezado ? encabezado[1].length : null;

    if (saltando !== null) {
      // La sección descartada termina en el siguiente título de igual o mayor
      // jerarquía; lo de adentro se va con ella.
      if (nivel !== null && nivel <= saltando) saltando = null;
      else continue;
    }

    if (enPuente) {
      if (esVacia(linea)) enPuente = false;
      continue;
    }

    if (enCabecera) {
      if (encabezado || RE_SEPARADOR.test(linea)) {
        enCabecera = false;
        // El separador que cierra la cabecera se va con ella.
        if (RE_SEPARADOR.test(linea)) continue;
      } else {
        if (RE_CABECERA_FASE.test(linea)) {
          cuenta.cabecera += 1;
          continue;
        }
        if (RE_EXTENSION.test(linea) || RE_CORTE.test(linea) || RE_PLAN_DE_PARTE.test(linea)) {
          cuenta.plan += 1;
          continue;
        }
      }
    }

    if (RE_MARCA_DE_PARTE.test(linea)) {
      cuenta.marcas += 1;
      // El separador que precede a la marca queda huérfano.
      while (salida.length && esVacia(salida.at(-1))) salida.pop();
      if (salida.length && RE_SEPARADOR.test(salida.at(-1))) salida.pop();
      continue;
    }

    if (RE_PUENTE.test(linea)) {
      cuenta.puentes += 1;
      enPuente = true;
      continue;
    }

    if (hayReferenciasGenerales && RE_REFERENCIAS_SEGMENTO.test(linea)) {
      cuenta.referencias += 1;
      saltando = nivel;
      while (salida.length && esVacia(salida.at(-1))) salida.pop();
      if (salida.length && RE_SEPARADOR.test(salida.at(-1))) salida.pop();
      continue;
    }

    salida.push(linea);
  }

  const removidos = [];
  if (cuenta.cabecera) removidos.push("la línea de fase y serie");
  if (cuenta.plan) removidos.push("el plan de cortes");
  if (cuenta.marcas) {
    removidos.push(cuenta.marcas === 1 ? "1 marca «PARTE»" : `${cuenta.marcas} marcas «PARTE»`);
  }
  if (cuenta.puentes) {
    removidos.push(cuenta.puentes === 1 ? "1 puente entre entregas" : `${cuenta.puentes} puentes entre entregas`);
  }
  if (cuenta.referencias) {
    removidos.push(
      `${cuenta.referencias} bloque${cuenta.referencias === 1 ? "" : "s"} de referencias por segmento (sus fuentes quedan en las referencias generales)`,
    );
  }

  const contenido = salida
    .join("\n")
    // Tres o más saltos seguidos quedan de lo que se sacó en el medio.
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*(?:-{3,}\s*\n)+/, "")
    .trim();

  return { contenido, removidos };
}
