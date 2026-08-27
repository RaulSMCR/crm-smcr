// src/lib/jsonld.js
//
// Identidades estables del grafo JSON-LD.
//
// Hasta ahora cada página emitía sus nodos sueltos: el artículo traía un autor
// embebido con nombre y foto, y el perfil de esa misma persona traía otro nodo
// `Person` con los mismos datos. Para un buscador **eso son dos personas
// distintas que se llaman igual**, no una persona con dos apariciones. Lo mismo
// con la organización, que aparecía tres veces con tres formas distintas.
//
// Un `@id` estable y absoluto resuelve eso: el artículo deja de describir a su
// autor y pasa a apuntar al `@id` del perfil, que es donde la persona está
// descrita una sola vez y con sus credenciales. Es la diferencia entre un
// conjunto de fichas sueltas y un grafo.

import { SITE_URL, siteUrl } from '@/lib/site-url';

export const ID_ORGANIZACION = `${SITE_URL}/#organization`;
export const ID_SITIO = `${SITE_URL}/#website`;

export const idPersona = (slug) => `${siteUrl(`profesionales/${slug}`)}#person`;
export const idArticulo = (slug) => `${siteUrl(`blog/${slug}`)}#article`;
export const idServicio = (slug) => `${siteUrl(`servicios/${slug}`)}#service`;

/** Referencia a un nodo ya descrito en otra parte del grafo. */
export const ref = (id) => ({ '@id': id });

const NOMBRE = 'Salud Mental Costa Rica';

/**
 * Especialidades médicas que la organización puede declarar, según qué
 * disciplinas ejercen los profesionales publicados.
 *
 * Los valores son miembros del enum `MedicalSpecialty` de schema.org: texto
 * libre como "Salud mental" lo rechaza el validador. Solo se listan las
 * disciplinas cuyo ejercicio es médico; psicología, nutrición o pedagogía no
 * corresponden a una especialidad médica y no entran acá.
 */
const ESPECIALIDAD_MEDICA_POR_DISCIPLINA = Object.freeze({
  'Psiquiatría': 'Psychiatric',
});

/**
 * Traduce las disciplinas del equipo a especialidades médicas declarables.
 *
 * Devuelve un arreglo vacío mientras no haya ningún profesional de una
 * disciplina médica, que es lo que corresponde: declarar `medicalSpecialty`
 * sin nadie que la ejerza es afirmar ante Google algo que el equipo no sostiene.
 *
 * @param {string[]} disciplinas  valores de `ProfessionalProfile.specialty`
 */
export function especialidadesMedicas(disciplinas = []) {
  const codigos = new Set();
  for (const disciplina of disciplinas) {
    const codigo = ESPECIALIDAD_MEDICA_POR_DISCIPLINA[String(disciplina || '').trim()];
    if (codigo) codigos.add(codigo);
  }
  return [...codigos];
}

/**
 * La organización. Es el único lugar donde se la describe; el resto la
 * referencia por `@id`.
 *
 * `medicalSpecialty` y el tipo `MedicalBusiness` se activan **solos** cuando el
 * equipo suma un profesional de una disciplina médica. Quedó cableado en vez de
 * comentado para que nadie tenga que acordarse: el día que se apruebe un
 * psiquiatra, el marcado cambia en el siguiente render. Y si ese profesional se
 * da de baja, vuelve a `Organization` sin dejar una afirmación colgada.
 *
 * @param {{disciplinas?: string[]}} [opciones]  disciplinas de los profesionales publicados
 */
export function nodoOrganizacion({ disciplinas = [] } = {}) {
  const especialidades = especialidadesMedicas(disciplinas);

  return {
    // Solo se declara negocio médico cuando alguien del equipo ejerce medicina.
    // Con un equipo de psicólogos y nutricionistas, `MedicalBusiness`
    // sobredeclararía.
    '@type': especialidades.length ? ['Organization', 'MedicalBusiness'] : 'Organization',
    '@id': ID_ORGANIZACION,
    ...(especialidades.length
      ? { medicalSpecialty: especialidades.length === 1 ? especialidades[0] : especialidades }
      : {}),
    name: NOMBRE,
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: siteUrl('logo.svg') },
    // Domicilio de registro de la empresa. Solo localidad y país: no se declara
    // una calle que no existe como punto de atención al público.
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'San José',
      addressCountry: 'CR',
    },
    areaServed: { '@type': 'Country', name: 'Costa Rica' },
    description:
      'Plataforma interdisciplinaria de bienestar y salud mental en Costa Rica. Psicología, nutrición, deporte y más.',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+506-7129-1909',
      email: 'contacto@saludmentalcostarica.com',
      contactType: 'customer service',
      availableLanguage: 'Spanish',
    },
    sameAs: [
      'https://www.instagram.com/saludmentalcostarica',
      'https://www.facebook.com/saludmentalcostarica',
      'https://www.linkedin.com/company/saludmentalcostarica',
      'https://www.youtube.com/@saludmentalcostarica',
    ],
  };
}

/**
 * El sitio, con su acción de búsqueda.
 *
 * `SearchAction` apunta a `/blog?q=`, que es la única búsqueda real que existe
 * —la de la biblioteca—. Declarar una búsqueda que no funciona sería peor que no
 * declarar ninguna.
 */
export function nodoSitio() {
  return {
    '@type': 'WebSite',
    '@id': ID_SITIO,
    url: SITE_URL,
    name: NOMBRE,
    inLanguage: 'es-CR',
    publisher: ref(ID_ORGANIZACION),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl('blog')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Envuelve varios nodos en un solo bloque `@graph`.
 *
 * Agrupar importa: los nodos de una misma página en un único script con contexto
 * compartido se leen como un grafo conectado, mientras que N scripts sueltos se
 * leen como N documentos que casualmente están juntos.
 */
export function grafo(...nodos) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodos.filter(Boolean),
  };
}

/** `ItemList` para las páginas de listado. */
export function nodoListado({ id, nombre, items }) {
  return {
    '@type': 'ItemList',
    '@id': id,
    name: nombre,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: item.url,
      name: item.nombre,
      ...(item.id ? { item: ref(item.id) } : {}),
    })),
  };
}

/** Migas, que también forman parte del grafo de la página. */
export function nodoMigas(pasos) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: pasos.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.nombre,
      item: p.url,
    })),
  };
}
