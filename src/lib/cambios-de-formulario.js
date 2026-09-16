// src/lib/cambios-de-formulario.js
//
// Qué se editó en un formulario y todavía no se guardó.
//
// `cambios-pendientes.js` resuelve el caso del panel de taxonomía: campos
// controlados que se registran uno por uno mientras se escriben. Los
// formularios del hub profesional son de la otra clase —no controlados, con
// `defaultValue`, y un `submit` que arma el payload entero de una vez—, y
// pasarlos a campos controlados solo para poder contarlos sería reescribir la
// pantalla completa.
//
// Acá el cambio se deduce comparando el formulario contra la foto que se le
// tomó al montarlo. Lógica pura: recibe un nodo de formulario y un mapa de
// campos, y no sabe de React ni de Prisma.
//
// El mapa de campos es explícito a propósito. Dentro del formulario de un
// módulo vive además el bloque de ingesta de `.md`, con su selector y su
// input de archivo: leer «todo lo que haya en el formulario» contaría esos
// controles como ediciones del módulo. Solo se mira lo que está en el mapa.

/** Cómo se lee y se nombra cada campo: `{ etiqueta, tipo }`. */
const TIPOS = new Set(["texto", "casilla", "lista"]);

const vacio = (valor) => valor === null || valor === undefined || valor === "";

/**
 * ¿Son el mismo valor a efectos de «esto no se editó»?
 *
 * Misma regla que en `cambios-pendientes.js` —null, undefined y "" son lo
 * mismo para un campo de texto opcional— más el caso de las listas de
 * casillas, donde lo que importa es el conjunto y no el orden.
 */
export function mismoValor(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const izquierda = [...(a || [])].map(String).sort();
    const derecha = [...(b || [])].map(String).sort();
    return izquierda.length === derecha.length && izquierda.every((valor, i) => valor === derecha[i]);
  }
  if (a === b) return true;
  return vacio(a) && vacio(b);
}

function leerCampo(nodo, spec = {}) {
  const tipo = TIPOS.has(spec.tipo) ? spec.tipo : "texto";
  const porDefecto = tipo === "lista" ? [] : tipo === "casilla" ? false : "";
  if (!nodo) return porDefecto;

  // `namedItem` devuelve un nodo suelto o una RadioNodeList cuando varios
  // controles comparten el nombre (las casillas de funciones del hub).
  const varios = !nodo.tagName && typeof nodo.length === "number";

  if (tipo === "lista") {
    const nodos = varios ? Array.from(nodo) : [nodo];
    return nodos.filter((control) => control.checked).map((control) => String(control.value));
  }

  const uno = varios ? nodo[0] : nodo;
  if (!uno) return porDefecto;
  if (tipo === "casilla") return Boolean(uno.checked);
  return String(uno.value ?? "");
}

/**
 * La foto del formulario: solo los campos del mapa, con el valor que tienen ahora.
 *
 * @param {HTMLFormElement|null} formulario
 * @param {Record<string, {etiqueta: string, tipo?: string}>} campos
 */
export function leerFormulario(formulario, campos = {}) {
  const valores = {};
  const elementos = formulario?.elements;
  for (const [campo, spec] of Object.entries(campos)) {
    valores[campo] = leerCampo(elementos?.namedItem?.(campo) ?? null, spec);
  }
  return valores;
}

/**
 * Texto corto y legible de un valor, para el informe y para la barra.
 *
 * Se recorta porque acá hay campos que son un artículo entero en Markdown: un
 * informe que pega el cuerpo completo dos veces no se lee.
 */
export function textoDeValor(valor, limite = 90) {
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "(ninguna)";
  if (valor === true) return "sí";
  if (valor === false) return "no";
  if (vacio(valor)) return "(vacío)";
  const texto = String(valor).replace(/\s+/g, " ").trim();
  if (!texto) return "(vacío)";
  return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
}

/**
 * Las líneas de «esto cambió», en el orden del mapa de campos.
 *
 * @returns {Array<{campo: string, etiqueta: string, antes: string, despues: string}>}
 */
export function diferenciasDeFormulario(base = {}, actual = {}, campos = {}) {
  const lineas = [];
  for (const [campo, spec] of Object.entries(campos)) {
    if (mismoValor(base[campo], actual[campo])) continue;
    lineas.push({
      campo,
      etiqueta: spec.etiqueta || campo,
      antes: textoDeValor(base[campo]),
      despues: textoDeValor(actual[campo]),
    });
  }
  return lineas;
}

/** Firma estable de un conjunto de líneas, para no re-renderizar de más. */
export function firmaDeLineas(lineas = []) {
  return lineas.map((linea) => `${linea.campo}=${linea.despues}`).join("|");
}
