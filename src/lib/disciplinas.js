// src/lib/disciplinas.js
//
// Catálogo de disciplinas del equipo.
//
// Antes `specialty` era texto libre, y con cuatro perfiles ya había cuatro
// grafías para lo mismo: "psicologia clínica", "Psicología Clínica",
// "Psicólogo clínico" y "Psicólogo". Ese valor alimenta el `jobTitle` de dos
// esquemas JSON-LD distintos, así que la inconsistencia no era cosmética: cuatro
// grafías son cuatro entidades distintas para un buscador.
//
// Es una constante validada y no un enum de Prisma a propósito. Un enum obliga a
// una migración de tipo cada vez que el equipo suma una disciplina, y este
// proyecto crece justamente por ahí.
//
// **`nombre` y `titulo` no son lo mismo, y la distinción importa.** `nombre` es
// la disciplina —el campo del saber— y es lo que se muestra en las fichas.
// `titulo` es cómo se llama quien la ejerce, y es lo único que puede ir en
// `jobTitle`: un cargo es una persona, no un área. Poner "Psicología clínica"
// como jobTitle es tan incorrecto como decir que el puesto de alguien es
// "Contabilidad".

export const DISCIPLINAS = Object.freeze([
  { id: 'psicologia-clinica', nombre: 'Psicología clínica', titulo: 'Psicólogo clínico' },
  { id: 'psiquiatria', nombre: 'Psiquiatría', titulo: 'Psiquiatra' },
  { id: 'nutricion', nombre: 'Nutrición', titulo: 'Nutricionista' },
  { id: 'terapia-fisica', nombre: 'Terapia física', titulo: 'Terapeuta físico' },
  { id: 'ciencias-del-deporte', nombre: 'Ciencias del deporte', titulo: 'Profesional en ciencias del deporte' },
  { id: 'musicoterapia', nombre: 'Musicoterapia', titulo: 'Musicoterapeuta' },
  { id: 'terapia-de-lenguaje', nombre: 'Terapia de lenguaje', titulo: 'Terapeuta de lenguaje' },
  { id: 'pedagogia', nombre: 'Pedagogía', titulo: 'Pedagogo' },
  { id: 'acompanamiento-terapeutico', nombre: 'Acompañamiento terapéutico', titulo: 'Acompañante terapéutico' },
]);

const POR_NOMBRE = new Map(DISCIPLINAS.map((d) => [d.nombre.toLowerCase(), d]));
const POR_ID = new Map(DISCIPLINAS.map((d) => [d.id, d]));

/** Nombres válidos, para poblar un `<select>`. */
export const NOMBRES_DISCIPLINA = DISCIPLINAS.map((d) => d.nombre);

/** ¿Es un nombre del catálogo? */
export function esDisciplinaValida(nombre) {
  return POR_NOMBRE.has(String(nombre || '').trim().toLowerCase());
}

export function disciplinaPorNombre(nombre) {
  return POR_NOMBRE.get(String(nombre || '').trim().toLowerCase()) || null;
}

export function disciplinaPorId(id) {
  return POR_ID.get(String(id || '').trim()) || null;
}

/**
 * Cómo se llama quien ejerce esta disciplina. Es lo que va en `jobTitle`.
 *
 * Si el valor guardado no está en el catálogo —un perfil viejo, o alguien que
 * escribió a mano— se devuelve tal cual en vez de inventar un título. Emitir el
 * dato crudo es preferible a emitir uno derivado que podría ser falso, y en
 * categoría YMYL una credencial inventada es peor que una imprecisa.
 */
export function tituloDe(nombreDisciplina) {
  const d = disciplinaPorNombre(nombreDisciplina);
  return d ? d.titulo : String(nombreDisciplina || '').trim();
}
