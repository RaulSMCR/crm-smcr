import { SEO_LIMITS } from "@/lib/seo";
import { normalizeTopicSlug, validateTopicSlug } from "@/lib/topic";

/**
 * Lee un `.md` del contrato de contenido de hubs y lo convierte al payload de
 * `ProfessionalHubModule` (o de `ProfessionalHub`, si es `_hub.md`).
 *
 * No toca Prisma ni el navegador: todo lo que necesita saber está en el texto
 * del archivo, así que se puede testear en Node contra los archivos reales de
 * `content/hub-raul/`. Lo que sí requiere base —canibalización, enlaces que
 * existen, diff contra la fila— vive en `src/lib/hub-ingest.js`.
 *
 * El contrato del archivo está en `docs/hubs/ESPECIFICACION-ingesta-md.md`, y
 * ahí también está por qué el destino es una fila y no un archivo del
 * repositorio: el panel corre con el filesystem en solo lectura.
 */

export const MAX_ARCHIVO_BYTES = 2 * 1024 * 1024;
export const MAX_ARCHIVOS_LOTE = 12;
export const EXTENSIONES = [".md", ".markdown", ".mdown", ".txt"];

/** Marcadores de bloque semántico que la especificación de contenido define. */
export const BLOQUES_CONOCIDOS = Object.freeze(["cuando-consultar", "riesgo", "aviso"]);

/** Los que toda pieza publicada debería traer. Su ausencia es aviso, no bloqueo. */
export const BLOQUES_ESPERADOS = Object.freeze(["cuando-consultar", "riesgo"]);

/** El slug del módulo de tratamiento, que es de tipo TREATMENT y no TOPIC. */
export const SLUG_TRATAMIENTO = "tratamiento-breve-15-sesiones";

/**
 * Campos del hub que NO se aceptan por archivo, con la razón que se le muestra
 * a quien importa. `slug` mueve una URL viva, `profileSlug` decide de quién es
 * el hub y `status` es un acto de publicación: ninguno debería cambiar porque
 * alguien arrastró un documento.
 */
export const CAMPOS_HUB_IGNORADOS = Object.freeze({
  slug: "el slug del hub no se cambia por archivo: movería una URL publicada",
  profileSlug: "el perfil profesional del hub se elige en el formulario",
  perfil: "el perfil profesional del hub se elige en el formulario",
  status: "publicar es un acto aparte, no un campo del documento",
  estado: "publicar es un acto aparte, no un campo del documento",
});

const RE_PRECIO = /₡|\b800-|\+506|\b506\d{8}\b/;
const RE_ABSOLUTO = /https?:\/\/(?:www\.)?saludmentalcostarica\.com/i;
const RE_HTML = /<\s*(?:script|iframe|object|embed|style|form)\b|javascript:|\son\w+\s*=/i;
const RE_ENLACE_MD = /\[[^\]]*\]\(([^)\s]+)/g;

// ---------------------------------------------------------------------------
// YAML mínimo
// ---------------------------------------------------------------------------

/**
 * Escalar de frontmatter: comillas, booleanos, enteros y listas en una línea.
 *
 * Los enteros se devuelven como número porque `orden` alimenta una columna
 * `Int`. Un teléfono como `50671291909` también cae acá y sale número; quien lo
 * consume lo pasa por `String()`, que es más simple que enseñarle al parser a
 * distinguir un teléfono de un entero.
 */
export function parseEscalarYaml(raw) {
  const valor = String(raw ?? "").trim();
  if (!valor) return "";

  const sinComillas = valor.replace(/^(['"])([\s\S]*)\1$/, "$2");
  if (sinComillas !== valor) return sinComillas;

  if (valor === "true") return true;
  if (valor === "false") return false;
  if (valor === "null" || valor === "~") return "";

  if (valor.startsWith("[") && valor.endsWith("]")) {
    return valor
      .slice(1, -1)
      .split(",")
      .map((item) => String(item).trim().replace(/^(['"])([\s\S]*)\1$/, "$2"))
      .filter(Boolean);
  }

  if (/^-?\d{1,15}$/.test(valor)) return Number(valor);
  return valor;
}

function sangria(linea) {
  return linea.length - linea.trimStart().length;
}

/**
 * Parser de indentación para el frontmatter.
 *
 * No es YAML completo y no pretende serlo: cubre lo que el contrato usa —pares
 * `clave: valor`, listas con guión, un nivel de anidamiento por sección (que es
 * lo que necesita `_hub.md`) y bloques `|` y `>`—. Traer una librería de YAML
 * para esto sería agregar una dependencia a un proyecto que no tiene ninguna
 * para leer texto.
 */
function parseNivel(lineas, desde, sangriaNivel) {
  const esLista = lineas[desde] && /^\s*-\s?/.test(lineas[desde]);
  const salida = esLista ? [] : {};
  let i = desde;

  while (i < lineas.length) {
    const linea = lineas[i];
    const indent = sangria(linea);
    if (indent < sangriaNivel) break;

    if (indent > sangriaNivel) {
      i += 1;
      continue;
    }

    const contenido = linea.trim();

    if (esLista) {
      if (!contenido.startsWith("-")) break;
      salida.push(parseEscalarYaml(contenido.replace(/^-\s?/, "")));
      i += 1;
      continue;
    }

    const par = contenido.match(/^([A-Za-z_][\w .-]*)\s*:\s*(.*)$/);
    if (!par) {
      i += 1;
      continue;
    }

    const clave = par[1].trim();
    const resto = par[2].trim();

    if (resto === "|" || resto === ">" || resto === "|-" || resto === ">-") {
      const partes = [];
      let j = i + 1;
      while (j < lineas.length && (sangria(lineas[j]) > sangriaNivel || !lineas[j].trim())) {
        partes.push(lineas[j].trim());
        j += 1;
      }
      salida[clave] = resto.startsWith(">") ? partes.join(" ").trim() : partes.join("\n").trim();
      i = j;
      continue;
    }

    if (resto === "") {
      const siguiente = lineas.findIndex((l, idx) => idx > i && l.trim());
      if (siguiente !== -1 && sangria(lineas[siguiente]) > sangriaNivel) {
        const [valor, hasta] = parseNivel(lineas, siguiente, sangria(lineas[siguiente]));
        salida[clave] = valor;
        i = hasta;
        continue;
      }
      salida[clave] = "";
      i += 1;
      continue;
    }

    salida[clave] = parseEscalarYaml(resto);
    i += 1;
  }

  return [salida, i];
}

export function parseFrontmatter(texto) {
  const lineas = String(texto || "")
    .split("\n")
    .filter((linea) => linea.trim() && !/^\s*#/.test(linea));
  if (!lineas.length) return {};
  const [valor] = parseNivel(lineas, 0, sangria(lineas[0]));
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
}

/** Separa el frontmatter del cuerpo. Sin `---` de apertura no hay frontmatter. */
export function partirDocumento(source) {
  const normalizado = String(source || "")
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n");
  const match = normalizado.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: "", body: normalizado.trim(), tieneFrontmatter: false };
  return { frontmatter: match[1], body: match[2].trim(), tieneFrontmatter: true };
}

// ---------------------------------------------------------------------------
// Lectura del cuerpo
// ---------------------------------------------------------------------------

/**
 * Los `##` del cuerpo, que son los que alimentan el índice lateral.
 *
 * Hoy la plantilla imprime un índice fijo de dos entradas
 * (`src/app/raul-olmedo-evans/[tema]/page.js`), así que esto todavía no se ve.
 * Se extrae igual y viaja en `metadata.encabezados`: el día que el índice se
 * genere de verdad, el contenido ya está leído y no hay que reimportar nada.
 */
export function leerEncabezados(body) {
  const salida = [];
  for (const linea of String(body || "").split("\n")) {
    const match = linea.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!match) continue;
    const texto = match[2].replace(/[*_`]/g, "").trim();
    salida.push({ nivel: match[1].length, texto, id: normalizeTopicSlug(texto) });
  }
  return salida;
}

/** Los marcadores `<!-- bloque: x -->` en el orden en que aparecen. */
export function leerBloques(body) {
  const salida = [];
  const re = /<!--\s*bloque:\s*([a-z-]+)\s*-->/gi;
  let match = re.exec(String(body || ""));
  while (match) {
    const nombre = match[1].toLowerCase();
    if (!salida.includes(nombre)) salida.push(nombre);
    match = re.exec(String(body || ""));
  }
  return salida;
}

/** Rutas internas que el cuerpo enlaza, para verificarlas contra la base. */
export function leerEnlacesInternos(body) {
  const salida = [];
  const texto = String(body || "");
  let match = RE_ENLACE_MD.exec(texto);
  while (match) {
    const href = match[1].trim();
    if (href.startsWith("/") && !href.startsWith("//") && !salida.includes(href)) salida.push(href);
    match = RE_ENLACE_MD.exec(texto);
  }
  RE_ENLACE_MD.lastIndex = 0;
  return salida;
}

function esFechaISO(valor) {
  const texto = String(valor || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function lista(valor) {
  if (Array.isArray(valor)) return valor.map((item) => texto(item)).filter(Boolean);
  const plano = texto(valor);
  if (!plano) return [];
  return plano
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function avisarLongitud(avisos, etiqueta, valor, limites) {
  const largo = texto(valor).length;
  if (!largo) return;
  if (largo < limites.min) avisos.push(`${etiqueta}: ${largo} caracteres, corto (recomendado ${limites.min}–${limites.max})`);
  if (largo > limites.max) avisos.push(`${etiqueta}: ${largo} caracteres, largo (recomendado ${limites.min}–${limites.max})`);
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

export function esNombreMarkdown(nombre) {
  const limpio = String(nombre || "").toLowerCase();
  return EXTENSIONES.some((extension) => limpio.endsWith(extension));
}

export function slugDeArchivo(nombre) {
  return String(nombre || "")
    .replace(/\.[^.]+$/, "")
    .replace(/^_+/, "");
}

/**
 * Lee un documento completo y devuelve lo que la ingesta necesita para
 * mostrarlo, validarlo y escribirlo.
 *
 * Nunca lanza: un archivo ilegible vuelve con `bloqueos` y el resto del lote
 * sigue su curso. Quien importa cuatro archivos tiene que poder ver los tres
 * que están bien.
 */
export function parseHubDocument(source, nombreArchivo = "") {
  const avisos = [];
  const bloqueos = [];
  const { frontmatter: crudo, body, tieneFrontmatter } = partirDocumento(source);
  const frontmatter = tieneFrontmatter ? parseFrontmatter(crudo) : {};
  const nombre = String(nombreArchivo || "").trim();

  if (!esNombreMarkdown(nombre)) bloqueos.push(`«${nombre || "sin nombre"}» no es .md, .markdown ni .txt`);
  if (!tieneFrontmatter) bloqueos.push("el archivo no trae frontmatter entre --- y ---");

  const tipo = texto(frontmatter.tipo).toLowerCase();
  const base = slugDeArchivo(nombre);
  const clase = tipo === "hub" || base === "hub" || /^_hub$/i.test(String(nombre).replace(/\.[^.]+$/, "")) ? "hub" : "tema";

  const comunes = { archivo: nombre, clase, frontmatter, body, avisos, bloqueos };
  if (clase === "hub") return { ...comunes, ...leerHub(frontmatter, avisos, bloqueos) };
  return { ...comunes, ...leerTema({ frontmatter, body, base, avisos, bloqueos }) };
}

function validarCuerpo({ body, avisos, bloqueos }) {
  if (/^#\s+/m.test(body)) bloqueos.push("el cuerpo trae un «#»: el h1 sale del campo «titulo»");
  if (RE_PRECIO.test(body)) bloqueos.push("el cuerpo trae un precio o teléfono literal (₡, 800-, +506): el precio sale de la tarifa vigente");
  if (RE_ABSOLUTO.test(body)) bloqueos.push("el cuerpo enlaza con dominio absoluto: los enlaces internos van relativos a la raíz");
  if (RE_HTML.test(body)) bloqueos.push("el cuerpo trae HTML ejecutable");
  if (body.includes("\u0000")) bloqueos.push("el cuerpo trae bytes nulos");
  if (/^#{4,}\s/m.test(body)) avisos.push("hay encabezados de nivel 4 o más: el índice solo lee ## y ###");
}

function leerTema({ frontmatter, body, base, avisos, bloqueos }) {
  const slugArchivo = base;
  const slug = normalizeTopicSlug(slugArchivo);
  const errorSlug = validateTopicSlug(slug);
  if (errorSlug) bloqueos.push(errorSlug);
  if (slug && slugArchivo && slug !== slugArchivo) {
    avisos.push(`el nombre del archivo se normaliza: se va a usar «${slug}»`);
  }

  const titulo = texto(frontmatter.titulo || frontmatter.title);
  if (!titulo) bloqueos.push("falta «titulo», que es el h1 de la página");
  // Un archivo sin cuerpo no es necesariamente un error: puede venir a corregir
  // el frontmatter de un módulo que ya tiene texto. Si el módulo no existe, la
  // ingesta lo bloquea —ahí sí no hay nada que guardar—, pero eso lo decide
  // `leerLote`, que es quien sabe si la fila está o no.
  if (!body) avisos.push("el archivo no trae cuerpo: si el módulo ya existe, se conserva el que tiene");
  validarCuerpo({ body, avisos, bloqueos });

  const tituloSeo = texto(frontmatter.titulo_seo || frontmatter.metaTitle);
  const meta = texto(frontmatter.meta || frontmatter.meta_description);
  avisarLongitud(avisos, "título SEO", tituloSeo, SEO_LIMITS.title);
  avisarLongitud(avisos, "meta descripción", meta, SEO_LIMITS.description);

  const bloques = leerBloques(body);
  const faltantes = BLOQUES_ESPERADOS.filter((nombre) => !bloques.includes(nombre));
  if (faltantes.length) avisos.push(`falta el bloque ${faltantes.map((item) => `«${item}»`).join(" y ")}`);
  for (const bloque of bloques) {
    if (!BLOQUES_CONOCIDOS.includes(bloque)) avisos.push(`marcador de bloque desconocido: «${bloque}»`);
  }
  if (bloques.length) avisos.push("los marcadores de bloque se guardan, pero la plantilla todavía no los pinta como caja");

  const fecha = texto(frontmatter.fecha);
  const actualizado = texto(frontmatter.actualizado) || fecha;
  if (fecha && !esFechaISO(fecha)) avisos.push(`«fecha» no es una fecha ISO: «${fecha}»`);
  if (actualizado && !esFechaISO(actualizado)) avisos.push(`«actualizado» no es una fecha ISO: «${actualizado}»`);
  if (!fecha) avisos.push("falta «fecha»: el JSON-LD la necesita para datePublished");

  const orden = frontmatter.orden;
  const position = Number.isFinite(Number(orden)) && texto(orden) !== "" ? Math.max(0, Math.round(Number(orden))) : null;
  if (position === null && texto(orden) !== "") avisos.push(`«orden» no es un entero: «${texto(orden)}»`);

  const publicado = frontmatter.publicado === true || texto(frontmatter.publicado) === "true";
  const despublicar = frontmatter.publicado === false || texto(frontmatter.publicado) === "false";

  const encabezados = leerEncabezados(body);
  const enlaces = leerEnlacesInternos(body);
  const relacionados = lista(frontmatter.articulos_relacionados);
  const herramienta = texto(frontmatter.herramienta_relacionada);
  const tarjeta = texto(frontmatter.tarjeta);
  if (!tarjeta) avisos.push("falta «tarjeta»: la grilla del hub va a usar el resumen");

  return {
    slugArchivo,
    slug,
    tipo: slug === SLUG_TRATAMIENTO ? "TREATMENT" : "TOPIC",
    encabezados,
    bloques,
    enlaces,
    relacionados,
    publicado,
    despublicar,
    // Payload con la forma de las columnas. `position` y el estado de
    // publicación los resuelve la ingesta: dependen de lo que ya haya en la
    // fila, y esto no consulta la base.
    modulo: {
      slug,
      type: slug === SLUG_TRATAMIENTO ? "TREATMENT" : "TOPIC",
      title: titulo,
      summary: texto(frontmatter.resumen) || null,
      body: body || null,
      metaTitle: tituloSeo || null,
      metaDescription: meta || null,
      focusKeyword: texto(frontmatter.busqueda_objetivo) || null,
      ogImage: texto(frontmatter.imagen_social || frontmatter.ogImage) || null,
      noindex: frontmatter.no_indexar === true || frontmatter.noindex === true,
      position,
      metadata: {
        fecha,
        actualizado,
        tarjeta,
        herramienta_relacionada: herramienta,
        articulos_relacionados: relacionados,
        bloques,
        encabezados: encabezados.map((item) => item.texto),
      },
    },
  };
}

/**
 * `_hub.md`: configura la fila del hub.
 *
 * Las claves de copy del esquema (`hero`, `cierre`, `barra_movil`, `pie`…) no
 * tienen columna, así que salen aparte en `copy` y la ingesta las guarda en un
 * módulo `CUSTOM` invisible con slug `_hub`. Es la opción sin migración; el día
 * que el copy salga de la plantilla, se mueven a una columna `copy Json?`.
 */
function leerHub(frontmatter, avisos, bloqueos) {
  const ignorados = [];
  for (const [clave, razon] of Object.entries(CAMPOS_HUB_IGNORADOS)) {
    if (clave in frontmatter) ignorados.push(`«${clave}» se ignora: ${razon}`);
  }
  avisos.push(...ignorados);

  const columnas = {};
  const asignar = (columna, valor, transformar = texto) => {
    if (valor === undefined) return;
    const limpio = transformar(valor);
    if (limpio === "" || limpio === null) return;
    columnas[columna] = limpio;
  };

  asignar("name", frontmatter.nombre ?? frontmatter.name);
  asignar("title", frontmatter.titulo ?? frontmatter.title);
  asignar("description", frontmatter.descripcion ?? frontmatter.description);
  asignar("whatsapp", frontmatter.whatsapp);
  asignar("modality", frontmatter.modalidad ?? frontmatter.modality);
  asignar("featuredSeriesSlug", frontmatter.serie_destacada ?? frontmatter.featuredSeriesSlug);
  asignar("heroVideoUrl", frontmatter.hero_video_url ?? frontmatter.heroVideoUrl);
  asignar("heroPosterUrl", frontmatter.hero_poster_url ?? frontmatter.heroPosterUrl);
  asignar("logoUrl", frontmatter.logo_url ?? frontmatter.logoUrl);
  asignar("metaTitle", frontmatter.titulo_seo ?? frontmatter.metaTitle);
  asignar("metaDescription", frontmatter.meta ?? frontmatter.metaDescription);
  asignar("ogImage", frontmatter.imagen_social ?? frontmatter.ogImage);
  asignar("focusKeyword", frontmatter.busqueda_objetivo ?? frontmatter.focusKeyword);

  const duracion = frontmatter.duracion_min ?? frontmatter.durationMin;
  if (duracion !== undefined && texto(duracion) !== "") {
    const minutos = Math.round(Number(duracion));
    if (Number.isFinite(minutos) && minutos > 0) columnas.durationMin = minutos;
    else avisos.push(`«duracion_min» no es un entero: «${texto(duracion)}»`);
  }

  const funciones = frontmatter.herramientas_habilitadas ?? frontmatter.enabledFunctions;
  if (funciones !== undefined) columnas.enabledFunctions = lista(funciones);

  if ("no_indexar" in frontmatter || "noindex" in frontmatter) {
    columnas.noindex = frontmatter.no_indexar === true || frontmatter.noindex === true;
  }

  avisarLongitud(avisos, "título SEO", columnas.metaTitle, SEO_LIMITS.title);
  avisarLongitud(avisos, "meta descripción", columnas.metaDescription, SEO_LIMITS.description);

  // Todo lo que no es columna es copy de sección: se conserva completo.
  const reservadas = new Set([
    "tipo", "nombre", "name", "titulo", "title", "descripcion", "description", "whatsapp",
    "modalidad", "modality", "duracion_min", "durationMin", "serie_destacada", "featuredSeriesSlug",
    "hero_video_url", "heroVideoUrl", "hero_poster_url", "heroPosterUrl", "logo_url", "logoUrl",
    "herramientas_habilitadas", "enabledFunctions", "titulo_seo", "metaTitle", "meta",
    "metaDescription", "imagen_social", "ogImage", "busqueda_objetivo", "focusKeyword",
    "no_indexar", "noindex", ...Object.keys(CAMPOS_HUB_IGNORADOS),
  ]);
  const copy = {};
  for (const [clave, valor] of Object.entries(frontmatter)) {
    if (!reservadas.has(clave)) copy[clave] = valor;
  }

  if (!Object.keys(columnas).length && !Object.keys(copy).length) {
    bloqueos.push("el archivo del hub no trae ningún campo reconocible");
  }
  if (Object.keys(copy).length) {
    avisos.push(`el copy de sección (${Object.keys(copy).join(", ")}) se guarda, pero la plantilla todavía trae su propio texto escrito`);
  }

  return { slug: null, tipo: "HUB", hub: columnas, copy };
}
