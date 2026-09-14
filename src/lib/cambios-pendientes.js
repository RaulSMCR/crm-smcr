// src/lib/cambios-pendientes.js
//
// Acumula ediciones sin guardar y sabe describir qué se tocó.
//
// Los paneles de administración guardaban campo por campo al salir del foco.
// Eso tiene dos problemas para quien edita muchas filas de una sentada: no hay
// un momento en que uno diga «listo», y no queda constancia de qué se cambió.
// Si además la acción falla en silencio —y fallaba: `requireAdmin` lanza y el
// manejador solo miraba `res.error`—, el resultado es que uno cree haber
// editado y no editó nada.
//
// Acá las ediciones se juntan, se cuentan, se pueden descartar y, al guardar,
// producen un informe de lo que efectivamente cambió.
//
// Lógica pura: no sabe de Prisma ni de React, y por eso se puede probar.

/** Clave estable de una entidad dentro del mapa de pendientes. */
export const claveDe = (tipo, id) => `${tipo}:${id}`;

const mismoValor = (a, b) => {
  if (a === b) return true;
  // null, undefined y "" son lo mismo para un campo de texto opcional: pasar de
  // `null` a "" no es una edición y no debe contar como cambio pendiente.
  const vacio = (v) => v === null || v === undefined || v === "";
  if (vacio(a) && vacio(b)) return true;
  return false;
};

/**
 * Registra (o revierte) la edición de un campo.
 *
 * Si el valor vuelve a ser el original, el cambio se borra en vez de quedar
 * registrado como «de X a X». Es lo que hace que el contador diga la verdad
 * cuando alguien escribe algo y se arrepiente.
 *
 * @param {object} pendientes  mapa actual (no se muta)
 * @param {object} cambio
 * @param {string} cambio.tipo        "serie" | "tema" | "disciplina" | "fase"
 * @param {string} cambio.id
 * @param {string} cambio.nombre      nombre de la entidad, para el informe
 * @param {string} cambio.campo       "name" | "description" | "isActive" | "phaseId"
 * @param {string} cambio.etiqueta    nombre legible del campo
 * @param {*}      cambio.antes       valor original (el del servidor)
 * @param {*}      cambio.despues     valor nuevo
 * @param {string} [cambio.antesTexto]
 * @param {string} [cambio.despuesTexto]
 * @returns {object} mapa nuevo
 */
export function registrarCambio(pendientes = {}, cambio = {}) {
  const { tipo, id, nombre, campo, etiqueta, antes, despues, antesTexto, despuesTexto } = cambio;
  if (!tipo || !id || !campo) return pendientes;

  const clave = claveDe(tipo, id);
  const actual = pendientes[clave];
  const campos = { ...(actual?.campos || {}) };

  if (mismoValor(antes, despues)) {
    delete campos[campo];
  } else {
    campos[campo] = {
      etiqueta: etiqueta || campo,
      antes,
      despues,
      antesTexto: antesTexto ?? textoPorDefecto(antes),
      despuesTexto: despuesTexto ?? textoPorDefecto(despues),
    };
  }

  const siguiente = { ...pendientes };
  if (!Object.keys(campos).length) {
    delete siguiente[clave];
  } else {
    // El nombre se refresca en cada registro: si en la misma tanda se renombró
    // la entidad, el informe debe nombrarla como se llamaba al empezar.
    siguiente[clave] = { tipo, id, nombre: actual?.nombre ?? nombre, campos };
  }
  return siguiente;
}

function textoPorDefecto(valor) {
  if (valor === null || valor === undefined || valor === "") return "(vacío)";
  if (valor === true) return "sí";
  if (valor === false) return "no";
  return String(valor);
}

/** Valor a mostrar en un campo: el pendiente si lo hay, si no el del servidor. */
export function valorDe(pendientes = {}, tipo, id, campo, porDefecto) {
  const campoPendiente = pendientes[claveDe(tipo, id)]?.campos?.[campo];
  return campoPendiente ? campoPendiente.despues : porDefecto;
}

/** ¿Tiene esta entidad algo sin guardar? */
export function tieneCambios(pendientes = {}, tipo, id) {
  return Boolean(pendientes[claveDe(tipo, id)]);
}

/** Cuántos campos hay sin guardar en total. */
export function contarCambios(pendientes = {}) {
  return Object.values(pendientes).reduce((total, e) => total + Object.keys(e.campos || {}).length, 0);
}

/**
 * Los cambios agrupados por entidad, listos para mostrar o para guardar.
 * `patch` es lo que se le pasa a la acción del servidor.
 */
export function cambiosPorEntidad(pendientes = {}) {
  return Object.values(pendientes).map((entidad) => ({
    tipo: entidad.tipo,
    id: entidad.id,
    nombre: entidad.nombre,
    patch: Object.fromEntries(Object.entries(entidad.campos).map(([campo, v]) => [campo, v.despues])),
    lineas: Object.entries(entidad.campos).map(([campo, v]) => ({
      campo,
      etiqueta: v.etiqueta,
      antes: v.antesTexto,
      despues: v.despuesTexto,
    })),
  }));
}

/**
 * Informe en texto de lo que se guardó y de lo que no.
 *
 * Se arma a partir del resultado real de cada acción, no de la intención: si
 * una fila falló, tiene que verse que falló y por qué. Un informe que lista
 * como guardado algo que el servidor rechazó es peor que no tener informe.
 *
 * @param {Array<{ nombre: string, lineas: Array, error?: string }>} resultados
 */
export function informeDeGuardado(resultados = []) {
  const guardados = resultados.filter((r) => !r.error);
  const fallidos = resultados.filter((r) => r.error);
  const campos = guardados.reduce((n, r) => n + (r.lineas?.length || 0), 0);

  const seGuardaron = campos === 1 ? "Se guardó 1 cambio" : `Se guardaron ${campos} cambios`;
  const enElementos = `${guardados.length} ${guardados.length === 1 ? "elemento" : "elementos"}`;

  let resumen;
  if (!resultados.length) resumen = "No había cambios que guardar.";
  else if (!fallidos.length) resumen = `${seGuardaron} en ${enElementos}.`;
  else if (!guardados.length) resumen = `No se pudo guardar ${fallidos.length === 1 ? "el cambio" : "ninguno de los cambios"}.`;
  else resumen = `${seGuardaron}, y ${fallidos.length} ${fallidos.length === 1 ? "elemento falló" : "elementos fallaron"}.`;

  return { resumen, guardados, fallidos, hayFallas: fallidos.length > 0, campos };
}
