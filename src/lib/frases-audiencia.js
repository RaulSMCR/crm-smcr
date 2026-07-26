// src/lib/frases-audiencia.js
//
// Deriva la audiencia de frases de un usuario registrado. Módulo puro: sin
// Prisma, sin React, sin red. Es la pieza que conecta el corpus editorial con
// las personas reales de la base.
//
// Tres cosas que conviene entender antes de tocar esto:
//
//   1. A un usuario logueado solo le corresponden 4 de las 8 audiencias. Las
//      otras 4 (MN26, HN26, MNJ, HNJ) son "no registradas": tono de
//      interpelación y conversión, pensado para pauta y placas de redes. Quien
//      ya está dentro de la app es, por definición, registrado, y recibe el
//      tono de homeostasis.
//
//   2. El campo `gender` de User tiene DOS vocabularios conviviendo, según en
//      qué formulario se haya escrito: el registro guarda
//      "femenino"/"masculino"/"no_binario"/"otro" y el editor de perfil guarda
//      "F"/"M"/"O"/"N". Se normalizan los dos. No se migra la columna acá: eso
//      es un cambio de datos aparte.
//
//   3. Mucha gente no cae en el binario M/F que la matriz del corpus asume, y
//      forzarla sería una decisión editorial que no nos toca. Para esas
//      personas se reparte de forma estable entre las dos audiencias
//      registradas de su franja etaria, usando un hash de su id: siempre les
//      toca la misma, no depende del día, y ambas son de tono homeostasis, así
//      que el registro es equivalente. La etiqueta es interna y NUNCA se le
//      muestra a la persona.

import { DEFAULT_TZ } from "@/lib/timezone";

// ─── Catálogo de audiencias ──────────────────────────────────────────────────
// Vive acá y no en frases.js a propósito: frases.js importa los 300 KB del
// corpus, así que cualquier componente cliente que necesitara solo las
// etiquetas se llevaba el corpus entero al navegador. Este módulo no importa
// ningún JSON.
//
// Matriz 2 géneros × 2 franjas × 2 estados de registro. El registro gobierna el
// tono: registrado recibe homeostasis (reflexión y eustrés), no registrado
// recibe interpelación (imperativo, segunda persona, conversión).

export const AUDIENCIAS = [
  { id: "MR26", label: "Mujeres registradas 26+", genero: "F", franja: "26+", registro: true, tono: "Homeostasis · reflexión amable" },
  { id: "HR26", label: "Hombres registrados 26+", genero: "M", franja: "26+", registro: true, tono: "Homeostasis · reflexión amable" },
  { id: "MN26", label: "Mujeres no registradas 26+", genero: "F", franja: "26+", registro: false, tono: "Interpelación · llamado a la acción" },
  { id: "HN26", label: "Hombres no registrados 26+", genero: "M", franja: "26+", registro: false, tono: "Interpelación · llamado a la acción" },
  { id: "MRJ", label: "Mujeres registradas −26", genero: "F", franja: "−26", registro: true, tono: "Homeostasis · lenguaje llano" },
  { id: "HRJ", label: "Hombres registrados −26", genero: "M", franja: "−26", registro: true, tono: "Homeostasis · lenguaje llano" },
  { id: "MNJ", label: "Mujeres no registradas −26", genero: "F", franja: "−26", registro: false, tono: "Interpelación · llamado a la acción" },
  { id: "HNJ", label: "Hombres no registrados −26", genero: "M", franja: "−26", registro: false, tono: "Interpelación · llamado a la acción" },
];

export const ROLES = { 1: "ancla", 2: "contrapunto" };

/** Las 4 audiencias que aplican a alguien que ya está registrado. */
export const AUDIENCIAS_REGISTRADAS = ["MR26", "HR26", "MRJ", "HRJ"];

/** Frontera etaria de la matriz del corpus. */
export const EDAD_CORTE = 26;

const FEMENINO = new Set(["f", "femenino", "female", "mujer"]);
const MASCULINO = new Set(["m", "masculino", "male", "hombre"]);

/**
 * Normaliza los dos vocabularios de `gender` a "F" | "M" | null.
 * null significa "no clasificable en el binario que asume el corpus", que
 * incluye no binario, otro, prefiero-no-decir y vacío.
 */
export function normalizarGenero(valor) {
  const v = String(valor || "").trim().toLowerCase();
  if (!v) return null;
  if (FEMENINO.has(v)) return "F";
  if (MASCULINO.has(v)) return "M";
  return null;
}

const FORMATO_HOY = new Intl.DateTimeFormat("en-CA", {
  timeZone: DEFAULT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Edad cumplida en años, calculada en hora de Costa Rica. Devuelve null si no
 * hay fecha de nacimiento o si la fecha no es válida.
 */
export function edadDe(birthDate, ahora = new Date()) {
  if (!birthDate) return null;
  const iso =
    birthDate instanceof Date
      ? birthDate.toISOString().slice(0, 10)
      : String(birthDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;

  const [an, mn, dn] = iso.split("-").map(Number);
  const [ah, mh, dh] = FORMATO_HOY.format(ahora).split("-").map(Number);

  let edad = ah - an;
  // Todavía no cumplió años este año.
  if (mh < mn || (mh === mn && dh < dn)) edad -= 1;
  return edad >= 0 && edad < 130 ? edad : null;
}

/**
 * Hash entero estable de una cadena (FNV-1a de 32 bits). Determinista entre
 * procesos y despliegues, que es justo lo que hace falta para que a una persona
 * le toque siempre la misma audiencia.
 */
export function hashEstable(texto) {
  let h = 0x811c9dc5;
  const s = String(texto || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Audiencia de frases de un usuario registrado.
 *
 * @param {{id: string, gender?: string|null, birthDate?: Date|string|null}} usuario
 * @returns {{audiencia: string, franja: "26+"|"-26", derivada: boolean, motivo: string}}
 *   `derivada` es true cuando la audiencia no salió de datos declarados sino
 *   del reparto estable. Sirve para que el panel sea honesto sobre qué sabe.
 */
export function audienciaDeUsuario(usuario, ahora = new Date()) {
  const genero = normalizarGenero(usuario?.gender);
  const edad = edadDe(usuario?.birthDate, ahora);

  // Sin fecha de nacimiento se asume 26+: es la franja mayoritaria de la base y
  // su tono admite mejor a un lector indeterminado que el de −26, que está
  // escrito para adolescentes y primeros veinte.
  const esJoven = edad !== null && edad < EDAD_CORTE;
  const franja = esJoven ? "-26" : "26+";

  if (genero === "F") {
    return {
      audiencia: esJoven ? "MRJ" : "MR26",
      franja,
      derivada: false,
      motivo: "género y edad declarados",
    };
  }
  if (genero === "M") {
    return {
      audiencia: esJoven ? "HRJ" : "HR26",
      franja,
      derivada: false,
      motivo: "género y edad declarados",
    };
  }

  // Reparto estable entre las dos audiencias registradas de la franja.
  const opciones = esJoven ? ["MRJ", "HRJ"] : ["MR26", "HR26"];
  return {
    audiencia: opciones[hashEstable(usuario?.id) % opciones.length],
    franja,
    derivada: true,
    motivo:
      edad === null
        ? "sin género ni fecha de nacimiento utilizables"
        : "género no declarado o fuera del binario del corpus",
  };
}

/** ¿Esta audiencia corresponde a alguien registrado? */
export function esAudienciaRegistrada(audiencia) {
  return AUDIENCIAS_REGISTRADAS.includes(audiencia);
}
