import { SEO_LIMITS } from "@/lib/seo";
import { normalizeTopicSlug, validateTopicSlug, safeTopicMediaUrl } from "@/lib/topic";
import { seccionesHub } from "@/lib/hub-sections";

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
export const MAX_ARCHIVOS_FEED = 100;
// Deja margen para el JSON dentro del límite de una función de Vercel.
export const MAX_LOTE_BYTES = 3 * 1024 * 1024;
export const EXTENSIONES = [".md", ".markdown", ".mdown", ".txt"];

/** Marcadores de bloque semántico que la especificación de contenido define. */
export const BLOQUES_CONOCIDOS = Object.freeze(["cuando-consultar", "riesgo", "aviso"]);

/** Los que toda pieza publicada debería traer. Su ausencia es aviso, no bloqueo. */
export const BLOQUES_ESPERADOS = Object.freeze(["cuando-consultar", "riesgo"]);

/** El slug del módulo de tratamiento, que es de tipo TREATMENT y no TOPIC. */
export const SLUG_TRATAMIENTO = "tratamiento-breve-15-sesiones";

/**
 * El slug del módulo invisible donde vive el copy de `_hub.md`.
 *
 * Vive acá y no en `hub-ingest` porque el panel también tiene que reconocerlo
 * —no es un módulo editable ni un destino elegible—, y `hub-ingest` arrastra
 * Prisma: importarlo desde un componente cliente metería la base en el bundle.
 */
export const SLUG_COPY_HUB = "_hub";

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
const RE_ABSOLUTO = /(?:https?:)?\/\/(?:www\.)?saludmentalcostarica\.com(?:[/:?#]|$)/i;
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
  let valor = String(raw ?? "").trim();
  let comilla = null;
  for (let i = 0; i < valor.length; i += 1) {
    if ((valor[i] === '"' || valor[i] === "'") && valor[i - 1] !== "\\") {
      comilla = comilla === valor[i] ? null : comilla || valor[i];
    }
    if (!comilla && valor[i] === "#" && (i === 0 || /\s/.test(valor[i - 1]))) {
      valor = valor.slice(0, i).trim();
      break;
    }
  }
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
 * El índice de `src/app/raul-olmedo-evans/[tema]/page.js` se arma con esto, y
 * el `id` es el mismo que `MarkdownRenderer` le pone al encabezado cuando se le
 * piden anclas (`src/lib/markdown-encabezados.js`): las dos puntas salen de
 * `normalizeTopicSlug`, así que el índice no puede apuntar a un ancla que la
 * página no tiene.
 *
 * Un encabezado precedido por `<!-- bloque: x -->` —en la línea anterior o con
 * solo líneas en blanco en medio— lleva además `bloque`. Es lo que le deja saber
 * a la plantilla que la pieza ya trae su propio «Cuándo conviene consultar» y no
 * tiene que agregar el genérico.
 */
export function leerEncabezados(body) {
  const salida = [];
  let bloquePendiente = null;
  for (const linea of String(body || "").split("\n")) {
    const marcador = linea.match(/^\s*<!--\s*bloque:\s*([a-z-]+)\s*-->\s*$/i);
    if (marcador) {
      bloquePendiente = marcador[1].toLowerCase();
      continue;
    }
    const match = linea.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!match) {
      if (linea.trim()) bloquePendiente = null;
      continue;
    }
    const texto = textoDeEncabezado(match[2]);
    salida.push({
      nivel: match[1].length,
      texto,
      id: normalizeTopicSlug(texto),
      ...(bloquePendiente ? { bloque: bloquePendiente } : {}),
    });
    bloquePendiente = null;
  }
  return salida;
}

/**
 * Lo que se lee de un encabezado: sin marcas de énfasis, sin la sintaxis de un
 * enlace y sin el cierre opcional `## Título ##`. Tiene que coincidir con el
 * texto que queda en el HTML, porque de los dos sale el mismo `id`.
 */
function textoDeEncabezado(crudo) {
  return String(crudo || "")
    .replace(/\s+#+$/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
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
    const href = match[1].trim().replace(/^<|>$/g, "");
    if (href.startsWith("/") && !href.startsWith("//") && !salida.includes(href)) salida.push(href);
    match = RE_ENLACE_MD.exec(texto);
  }
  RE_ENLACE_MD.lastIndex = 0;
  for (const referencia of texto.matchAll(/^\s{0,3}\[[^\]\n]+\]:\s*<?(\/[^\s>]*)/gm)) {
    const href = referencia[1];
    if (!href.startsWith("//") && !salida.includes(href)) salida.push(href);
  }
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
    .split(/[\\/]/).pop()
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
 *
 * `opciones.slug` es el módulo elegido en el panel: cuando viene, el nombre del
 * archivo deja de decidir el destino y pasa a ser un dato del informe. La
 * **clase** sigue saliendo del archivo —`_hub.md` o `tipo: hub` es
 * configuración del hub, y elegir un módulo para eso es una contradicción que
 * `hub-ingest` bloquea en vez de resolver por su cuenta.
 */
export function contieneFraseProhibida(source) {
  const texto = String(source).normalize("NFC").replace(/[*_`]/g, "").replace(/&oacute;|&#243;|&#xf3;/gi, "ó").replace(/&nbsp;/gi, " ");
  return /psic[oó]logos\s+en\s+costa\s+rica/iu.test(texto);
}

export function parseHubDocument(source, nombreArchivo = "", opciones = {}) {
  const avisos = [];
  const bloqueos = [];
  const { frontmatter: crudo, body, tieneFrontmatter } = partirDocumento(source);
  const frontmatter = tieneFrontmatter ? parseFrontmatter(crudo) : {};
  const nombre = String(nombreArchivo || "").trim();

  if (!esNombreMarkdown(nombre)) bloqueos.push(`«${nombre || "sin nombre"}» no es .md, .markdown ni .txt`);
  if (!tieneFrontmatter) bloqueos.push("el archivo no trae frontmatter entre --- y ---");

  const tipo = texto(frontmatter.tipo).toLowerCase();
  const base = slugDeArchivo(nombre);
  const elegido = texto(opciones?.slug);
  const clase = tipo === "hub" || base === "hub" || /^_hub$/i.test(String(nombre).replace(/\.[^.]+$/, "")) ? "hub" : "tema";

  const comunes = { archivo: nombre, clase, frontmatter, body, avisos, bloqueos };
  if (contieneFraseProhibida(source)) {
    bloqueos.push("el documento contiene la frase plural prohibida por el contrato del sitio");
  }
  if (opciones.feed) validarContratoFeed({ frontmatter, body, clase, bloqueos });
  if (clase === "hub") return { ...comunes, ...leerHub(frontmatter, avisos, bloqueos) };
  return { ...comunes, ...leerTema({ frontmatter, body, base: elegido || base, baseArchivo: base, elegido: Boolean(elegido), avisos, bloqueos }) };
}

export function validarCuerpo({ body, avisos, bloqueos }) {
  if (/^#\s+/m.test(body)) bloqueos.push("el cuerpo trae un «#»: el h1 sale del campo «titulo»");
  if (RE_PRECIO.test(body)) bloqueos.push("el cuerpo trae un precio o teléfono literal (₡, 800-, +506): el precio sale de la tarifa vigente");
  if (RE_ABSOLUTO.test(body)) bloqueos.push("el cuerpo enlaza con dominio absoluto: los enlaces internos van relativos a la raíz");
  if (RE_HTML.test(body)) bloqueos.push("el cuerpo trae HTML ejecutable");
  if (body.includes("\u0000")) bloqueos.push("el cuerpo trae bytes nulos");
  if (/^#{4,}\s/m.test(body)) avisos.push("hay encabezados de nivel 4 o más: el índice solo lee ## y ###");
}

function leerTema({ frontmatter, body, base, baseArchivo = null, elegido = false, avisos, bloqueos }) {
  const slugArchivo = base;
  const slug = normalizeTopicSlug(slugArchivo);
  const errorSlug = validateTopicSlug(slug);
  if (errorSlug) bloqueos.push(errorSlug);
  if (slug && slugArchivo && slug !== slugArchivo) {
    avisos.push(`el nombre del archivo se normaliza: se va a usar «${slug}»`);
  }
  // Con módulo elegido el nombre del archivo no vale como slug, pero sí como
  // aviso: quien suelta `borrador-final-v3.md` en un módulo tiene que leer en
  // qué página va a caer antes de aplicar.
  if (elegido && baseArchivo && normalizeTopicSlug(baseArchivo) !== slug) {
    avisos.push(`el nombre del archivo dice «${baseArchivo}»: se escribe en el módulo elegido, «${slug}»`);
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
  const tipoModulo = ({ tema: "TOPIC", tratamiento: "TREATMENT", personalizado: "CUSTOM" })[texto(frontmatter.tipo).toLowerCase()] || (slug === SLUG_TRATAMIENTO ? "TREATMENT" : "TOPIC");

  return {
    slugArchivo,
    slug,
    tipo: tipoModulo,
    tipoExplicito: ["tema", "tratamiento", "personalizado"].includes(texto(frontmatter.tipo).toLowerCase()),
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
      type: tipoModulo,
      title: titulo,
      summary: texto(frontmatter.resumen) || null,
      body: body || null,
      metaTitle: tituloSeo || null,
      metaDescription: meta || null,
      focusKeyword: texto(frontmatter.busqueda_objetivo) || null,
      ogImage: "imagen_social" in frontmatter || "ogImage" in frontmatter ? texto(frontmatter.imagen_social || frontmatter.ogImage) || null : undefined,
      noindex: "no_indexar" in frontmatter || "noindex" in frontmatter ? frontmatter.no_indexar === true || frontmatter.noindex === true : undefined,
      isFeatured: "destacada" in frontmatter ? frontmatter.destacada === true : undefined,
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

/** Contrato estricto del feed; el arrastre conserva sus avisos históricos. */
function validarContratoFeed({ frontmatter: fm, body, clase, bloqueos }) {
  if (clase === "tema") {
    for (const clave of ["titulo", "titulo_seo", "meta", "resumen", "tarjeta", "orden", "fecha", "actualizado", "herramienta_relacionada", "articulos_relacionados", "busqueda_objetivo", "publicado"]) {
      if (!Object.hasOwn(fm, clave)) bloqueos.push(`falta el campo obligatorio «${clave}»`);
    }
    for (const clave of ["titulo", "resumen", "tarjeta", "busqueda_objetivo"]) {
      if (!texto(fm[clave])) bloqueos.push(`«${clave}» no puede quedar vacío`);
    }
    for (const clave of ["titulo", "titulo_seo", "meta", "resumen", "tarjeta", "fecha", "actualizado", "herramienta_relacionada", "busqueda_objetivo"]) {
      if (fm[clave] !== undefined && typeof fm[clave] !== "string") bloqueos.push(`«${clave}» debe ser texto`);
    }
    if (!Number.isInteger(fm.orden) || fm.orden < 0) bloqueos.push("«orden» debe ser un entero no negativo");
    for (const clave of ["fecha", "actualizado"]) {
      if (!esFechaISO(fm[clave])) bloqueos.push(`«${clave}» debe ser una fecha ISO válida`);
    }
    if (!Array.isArray(fm.articulos_relacionados)) bloqueos.push("«articulos_relacionados» debe ser una lista");
    const marcados = seccionesHub(body).map((h) => h.bloque);
    for (const bloque of BLOQUES_ESPERADOS) {
      if (!marcados.includes(bloque)) bloqueos.push(`falta el bloque «${bloque}» antes de un encabezado ##`);
    }
    if (fm.tipo !== undefined && !["tema", "tratamiento", "personalizado"].includes(texto(fm.tipo).toLowerCase())) {
      bloqueos.push("«tipo» debe ser tema, tratamiento o personalizado");
    }
  }
  if ((clase === "tema" || fm.titulo_seo !== undefined) && (!texto(fm.titulo_seo) || texto(fm.titulo_seo).length > 60)) {
    bloqueos.push("«titulo_seo» debe tener entre 1 y 60 caracteres");
  }
  if ((clase === "tema" || fm.meta !== undefined) && (texto(fm.meta).length < 120 || texto(fm.meta).length > 155)) {
    bloqueos.push("«meta» debe tener entre 120 y 155 caracteres");
  }
  for (const clave of ["destacada", "no_indexar", "publicado"]) {
    if (fm[clave] !== undefined && typeof fm[clave] !== "boolean") bloqueos.push(`«${clave}» debe ser true o false`);
  }
  if (fm.imagen_social && !safeTopicMediaUrl(fm.imagen_social)) bloqueos.push("«imagen_social» debe ser una ruta desde / o una URL HTTPS");
  if (/(?:[$€₡]\s*\d|\b\d[\d.,]*\s*(?:colones|dólares|euros)\b|(?<!\d)(?:\+?506[\s-]*)?[2-8]\d{3}[\s-]?\d{4}(?!\d))/iu.test(body)) {
    bloqueos.push("el cuerpo contiene un precio o teléfono literal: usá las variables del hub");
  }
  if (/^[^\n]+\n={2,}\s*$/m.test(body)) bloqueos.push("el cuerpo trae un H1 subrayado: el h1 sale de «titulo»");
}

/** `_hub.md`: columnas del hub y copy conservado en el módulo invisible _hub. */
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
