// src/lib/grados-academicos.js
//
// Título profesional (grado académico) de quien atiende.
//
// Es un tercer dato, distinto de los dos que ya existen en `disciplinas.js`:
//
//   • `nombre`   — la disciplina, el campo del saber: "Psicología clínica".
//   • `titulo`   — cómo se llama quien la ejerce: "Psicólogo clínico".
//   • el grado   — con qué se le nombra por su formación: "Lic.", "Dra.".
//
// El grado no se deriva ni de la disciplina ni del número de colegiatura: es un
// dato que solo la persona conoce, y por eso se le pregunta en el registro.
//
// **Las formas de género son entradas propias, no se infieren del nombre.** Un
// "Dr." donde va "Dra." queda impreso en un comprobante fiscal y en el contrato,
// así que quien se registra elige la suya y el sistema no adivina. Por eso hay
// seis entradas para cuatro grados: "Máster" y "Bachiller" son invariables en
// español, "Licenciado" y "Doctor" no lo son.

export const GRADOS_ACADEMICOS = Object.freeze([
  { id: "bachiller",   nombre: "Bachiller",   abreviatura: "Bach." },
  { id: "licenciado",  nombre: "Licenciado",  abreviatura: "Lic." },
  { id: "licenciada",  nombre: "Licenciada",  abreviatura: "Licda." },
  { id: "master",      nombre: "Máster",      abreviatura: "MSc." },
  { id: "doctor",      nombre: "Doctor",      abreviatura: "Dr." },
  { id: "doctora",     nombre: "Doctora",     abreviatura: "Dra." },
]);

const POR_ID = new Map(GRADOS_ACADEMICOS.map((g) => [g.id, g]));

/** ¿Es un identificador del catálogo? */
export function esGradoValido(id) {
  return POR_ID.has(String(id || "").trim().toLowerCase());
}

export function gradoPorId(id) {
  return POR_ID.get(String(id || "").trim().toLowerCase()) || null;
}

/** Normaliza lo que venga de un formulario al identificador guardable, o null. */
export function normalizarGrado(id) {
  const grado = gradoPorId(id);
  return grado ? grado.id : null;
}

/** "Lic.", "Dra."… Cadena vacía si el perfil todavía no lo declaró. */
export function abreviaturaDeGrado(id) {
  return gradoPorId(id)?.abreviatura || "";
}

/**
 * El nombre con el que la persona aparece en la factura, en el cobro de ONVO y
 * en el contrato: "Lic. Ana Solano".
 *
 * Sin grado declarado devuelve el nombre pelado en vez de inventar uno. Un
 * tratamiento equivocado en un comprobante fiscal es peor que ninguno.
 */
export function nombreConGrado(nombre, gradoId) {
  const limpio = String(nombre || "").trim();
  if (!limpio) return "";
  const abreviatura = abreviaturaDeGrado(gradoId);
  return abreviatura ? `${abreviatura} ${limpio}` : limpio;
}
