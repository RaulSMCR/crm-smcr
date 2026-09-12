import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { RESERVED_TOPIC_SLUGS } from "@/lib/topic";
import {
  MAX_ARCHIVOS_LOTE,
  MAX_ARCHIVO_BYTES,
  SLUG_TRATAMIENTO,
  parseHubDocument,
} from "@/lib/hub-markdown";

/**
 * Ingesta de documentos `.md` en un hub profesional.
 *
 * Dos pasadas sobre el mismo código: `leerLote` no escribe nada y devuelve el
 * informe con diferencias, avisos y bloqueos; `aplicarLote` vuelve a leer y
 * escribe en una transacción. Que las dos usen la misma función es lo que evita
 * que el informe prometa una cosa y la escritura haga otra.
 *
 * Reglas de escritura, que están en docs/hubs/ESPECIFICACION-ingesta-md.md y se
 * repiten acá porque es donde se incumplirían:
 *   - nunca borra: un módulo que no viene en el lote no se toca;
 *   - nunca duplica: slug existente se actualiza;
 *   - nunca publica: lo nuevo entra en borrador y publicar es un acto aparte.
 */

/** El slug del módulo invisible donde vive el copy de `_hub.md`. */
export const SLUG_COPY_HUB = "_hub";

/**
 * Rutas que son carpetas en `src/app/` y por lo tanto existen siempre.
 *
 * `RESERVED_TOPIC_SLUGS` cubre casi todas, pero no `ayuda-inmediata` —a la que
 * el contrato manda derivar el bloque de riesgo— ni los hubs con carpeta
 * propia. Sin esas tres, la validación de enlaces avisaría de rutas rotas que
 * no están rotas.
 */
const RUTAS_ESTATICAS = new Set([
  ...RESERVED_TOPIC_SLUGS,
  "ayuda-inmediata",
  "raul-olmedo-evans",
  "raul-olmedo",
]);

/**
 * Hubs que hoy tienen una página que los renderiza.
 *
 * Misma lista que `SLUGS_CON_RUTA` en `src/lib/professional-hub-queries.js`, y
 * por la misma razón: las páginas del hub son carpetas literales en `src/app/`,
 * así que un hub con otro slug se guarda bien y su URL devuelve 404. La ingesta
 * no puede arreglarlo, pero sí decirlo en cada fila que escribe.
 */
const HUBS_CON_RUTA = new Set(["raul-olmedo-evans"]);

const LIMITES_COLUMNA = { body: 50000, summary: 5000, metaTitle: 240, metaDescription: 1000, focusKeyword: 120 };

export function hashDocumento(texto) {
  return createHash("sha256").update(String(texto || ""), "utf8").digest("hex");
}

function recortar(valor, max = 120) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}

function iguales(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a || []) === JSON.stringify(b || []);
  const normal = (valor) => (valor === null || valor === undefined ? "" : String(valor));
  return normal(a) === normal(b);
}

const ETIQUETAS = {
  // Columnas del módulo.
  title: "título",
  body: "cuerpo",
  summary: "resumen",
  metaTitle: "título SEO",
  metaDescription: "meta descripción",
  focusKeyword: "búsqueda objetivo",
  ogImage: "imagen social",
  noindex: "no indexar",
  position: "orden",
  type: "tipo",
  tarjeta: "tarjeta",
  fecha: "fecha",
  actualizado: "actualizado",
  herramienta_relacionada: "herramienta relacionada",
  articulos_relacionados: "artículos relacionados",
  // Columnas del hub, que comparten la tabla del informe: sin estas, el diff de
  // `_hub.md` mostraría los nombres de las columnas en inglés.
  name: "nombre",
  description: "descripción",
  whatsapp: "WhatsApp",
  modality: "modalidad",
  durationMin: "duración (min)",
  featuredSeriesSlug: "serie destacada",
  heroVideoUrl: "video del hero",
  heroPosterUrl: "poster del hero",
  logoUrl: "logo",
  enabledFunctions: "funciones visibles",
};

/**
 * Diferencias entre la fila y lo que trae el archivo, en la forma que muestra la
 * pantalla. El cuerpo se compara pero no se imprime: en el informe va su
 * longitud, porque un diff de 2.000 caracteres dentro de una tabla no se lee.
 */
export function diffModulo(existente, payload) {
  const diff = [];
  const antesMeta = existente?.metadata && typeof existente.metadata === "object" ? existente.metadata : {};

  for (const campo of ["title", "summary", "metaTitle", "metaDescription", "focusKeyword", "ogImage", "noindex", "position", "type"]) {
    if (payload[campo] === undefined) continue;
    if (iguales(existente?.[campo], payload[campo])) continue;
    diff.push({ campo: ETIQUETAS[campo] || campo, antes: recortar(existente?.[campo]), despues: recortar(payload[campo]) });
  }

  for (const campo of ["tarjeta", "fecha", "actualizado", "herramienta_relacionada", "articulos_relacionados"]) {
    const despues = payload.metadata?.[campo];
    if (despues === undefined) continue;
    if (iguales(antesMeta[campo], despues)) continue;
    diff.push({
      campo: ETIQUETAS[campo],
      antes: recortar(Array.isArray(antesMeta[campo]) ? antesMeta[campo].join(", ") : antesMeta[campo]),
      despues: recortar(Array.isArray(despues) ? despues.join(", ") : despues),
    });
  }

  // `body` sin definir significa «el archivo no trae cuerpo y se conserva el de
  // la fila»: no es un cambio que haya que mostrar.
  const cuerpoAntes = String(existente?.body || "");
  const cuerpoDespues = String(payload.body || "");
  if (payload.body !== undefined && cuerpoAntes !== cuerpoDespues) {
    diff.push({
      campo: "cuerpo",
      antes: `${cuerpoAntes.length.toLocaleString("es-CR")} caracteres`,
      despues: `${cuerpoDespues.length.toLocaleString("es-CR")} caracteres`,
    });
  }

  return diff;
}

/**
 * Piezas del sitio que ya persiguen una búsqueda, para no publicar dos páginas
 * compitiendo entre ellas.
 *
 * Se consulta `focusKeyword` en las tablas que la tienen: módulos de hub, hubs,
 * artículos y servicios. `Topic` queda fuera porque no tiene la columna —guarda
 * `metaTitle` y `metaDescription` pero no palabra clave—, así que un tema de la
 * biblioteca no se puede comparar todavía. Es una omisión conocida, no un olvido.
 */
async function buscarCanibalizacion(keywords, { hubId }) {
  const buscadas = [...new Set(keywords.filter(Boolean).map((item) => item.toLowerCase()))];
  if (!buscadas.length) return new Map();

  // Un OR de `equals` insensibles en lugar de `in`: Prisma no aplica
  // `mode: "insensitive"` dentro de `in`, así que con `in` una diferencia de
  // mayúsculas dejaría pasar el conflicto. Son doce keywords como máximo.
  const comoSea = buscadas.map((keyword) => ({ focusKeyword: { equals: keyword, mode: "insensitive" } }));

  const [modulos, hubs, posts, servicios] = await Promise.all([
    prisma.professionalHubModule.findMany({
      where: { OR: comoSea },
      select: { id: true, slug: true, focusKeyword: true, hubId: true, isPublished: true, hub: { select: { slug: true } } },
    }),
    prisma.professionalHub.findMany({
      where: { OR: comoSea },
      select: { id: true, slug: true, focusKeyword: true, status: true },
    }),
    prisma.post.findMany({
      where: { OR: comoSea, status: "PUBLISHED" },
      select: { slug: true, focusKeyword: true },
    }),
    prisma.service.findMany({
      where: { OR: comoSea, isActive: true },
      select: { slug: true, focusKeyword: true },
    }),
  ]);

  const mapa = new Map();
  const agregar = (keyword, ruta, detalle) => {
    const clave = String(keyword || "").toLowerCase();
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push({ ruta, detalle });
  };

  for (const modulo of modulos) {
    // Un módulo del mismo hub y mismo slug es la fila que se está actualizando:
    // que persiga su propia búsqueda no es conflicto.
    if (modulo.hubId === hubId) continue;
    agregar(modulo.focusKeyword, `/${modulo.hub?.slug || "?"}/${modulo.slug}`, modulo.isPublished ? "módulo publicado" : "módulo en borrador");
  }
  for (const hub of hubs) {
    if (hub.id === hubId) continue;
    agregar(hub.focusKeyword, `/${hub.slug}`, `hub ${hub.status === "PUBLISHED" ? "publicado" : "en borrador"}`);
  }
  for (const post of posts) agregar(post.focusKeyword, `/blog/${post.slug}`, "artículo publicado");
  for (const servicio of servicios) agregar(servicio.focusKeyword, `/servicios/${servicio.slug}`, "servicio activo");

  // Los conflictos dentro del propio hub se resuelven aparte, comparando contra
  // los módulos que ya están en la fila (ver `leerLote`), porque ahí sí hace
  // falta saber si el que choca es el que se está reemplazando.
  return mapa;
}

/** Verifica rutas internas: artículos, servicios, temas, módulos del hub y rutas fijas. */
async function verificarRutas(rutas, { hubSlug, slugsDelHub }) {
  const pendientes = [...new Set(rutas.filter(Boolean))];
  if (!pendientes.length) return new Map();

  const slugsBlog = [];
  const slugsServicio = [];
  const slugsRaiz = [];
  for (const ruta of pendientes) {
    const partes = ruta.replace(/[?#].*$/, "").split("/").filter(Boolean);
    if (partes.length === 2 && partes[0] === "blog") slugsBlog.push(partes[1]);
    else if (partes.length === 2 && partes[0] === "servicios") slugsServicio.push(partes[1]);
    else if (partes.length === 1) slugsRaiz.push(partes[0]);
    else if (partes.length === 0) continue;
    else if (partes[0] === hubSlug) continue;
  }

  const [posts, servicios, temas] = await Promise.all([
    slugsBlog.length
      ? prisma.post.findMany({ where: { slug: { in: slugsBlog }, status: "PUBLISHED" }, select: { slug: true } })
      : [],
    slugsServicio.length
      ? prisma.service.findMany({ where: { slug: { in: slugsServicio }, isActive: true }, select: { slug: true } })
      : [],
    slugsRaiz.length
      ? prisma.topic.findMany({ where: { slug: { in: slugsRaiz }, status: "PUBLISHED", isActive: true }, select: { slug: true } })
      : [],
  ]);

  const publicados = {
    blog: new Set(posts.map((item) => item.slug)),
    servicios: new Set(servicios.map((item) => item.slug)),
    raiz: new Set(temas.map((item) => item.slug)),
  };

  const mapa = new Map();
  for (const ruta of pendientes) {
    const partes = ruta.replace(/[?#].*$/, "").split("/").filter(Boolean);
    if (!partes.length) {
      mapa.set(ruta, "ok");
      continue;
    }
    if (partes.length === 2 && partes[0] === "blog") {
      mapa.set(ruta, publicados.blog.has(partes[1]) ? "ok" : "no existe publicado");
      continue;
    }
    if (partes.length === 2 && partes[0] === "servicios") {
      mapa.set(ruta, publicados.servicios.has(partes[1]) ? "ok" : "no existe activo");
      continue;
    }
    if (partes.length === 2 && partes[0] === hubSlug) {
      mapa.set(ruta, slugsDelHub.has(partes[1]) ? "ok" : "no existe en este hub");
      continue;
    }
    if (partes.length === 1) {
      if (RUTAS_ESTATICAS.has(partes[0]) || publicados.raiz.has(partes[0])) mapa.set(ruta, "ok");
      else mapa.set(ruta, "no existe publicado");
      continue;
    }
    mapa.set(ruta, "no verificable");
  }
  return mapa;
}

/**
 * Acota a lo que aguanta cada columna, y lo dice.
 *
 * Recortar en silencio sería perder texto sin que nadie se enterara hasta leer
 * la página publicada y encontrarla cortada a media frase.
 */
function acotar(payload, avisos = []) {
  const salida = { ...payload };
  for (const [campo, max] of Object.entries(LIMITES_COLUMNA)) {
    if (typeof salida[campo] !== "string" || salida[campo].length <= max) continue;
    avisos.push(`el campo «${ETIQUETAS[campo] || campo}» se recortó a ${max.toLocaleString("es-CR")} caracteres`);
    salida[campo] = salida[campo].slice(0, max);
  }
  return salida;
}

/**
 * Lee el lote y arma el informe. **No escribe.**
 *
 * @param {object} entrada
 * @param {string} entrada.hubId
 * @param {Array<{nombre: string, texto: string}>} entrada.archivos
 */
export async function leerLote({ hubId, archivos }) {
  const hub = await prisma.professionalHub.findUnique({
    where: { id: String(hubId || "") },
    select: {
      id: true, slug: true, name: true, title: true, description: true, whatsapp: true,
      modality: true, durationMin: true, featuredSeriesSlug: true, heroVideoUrl: true,
      heroPosterUrl: true, logoUrl: true, enabledFunctions: true, status: true,
      metaTitle: true, metaDescription: true, ogImage: true, focusKeyword: true, noindex: true,
      modules: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!hub) return { error: "No se encontró el hub." };

  const entrada = Array.isArray(archivos) ? archivos : [];
  if (!entrada.length) return { error: "No llegó ningún archivo." };
  if (entrada.length > MAX_ARCHIVOS_LOTE) return { error: `Máximo ${MAX_ARCHIVOS_LOTE} archivos por lote.` };

  const porSlug = new Map(hub.modules.map((modulo) => [modulo.slug, modulo]));
  const slugsDelHub = new Set(hub.modules.map((modulo) => modulo.slug));
  const posicionesTomadas = new Map(hub.modules.map((modulo) => [modulo.position, modulo.slug]));
  const siguientePosicion = hub.modules.reduce((max, modulo) => Math.max(max, modulo.position + 1), 0);

  // 1) Parseo puro de cada archivo.
  const filas = entrada.map((archivo, indice) => {
    const nombre = String(archivo?.nombre || `archivo-${indice + 1}.md`);
    const texto = String(archivo?.texto ?? "");
    const parsed = parseHubDocument(texto, nombre);
    const bloqueos = [...parsed.bloqueos];
    if (Buffer.byteLength(texto, "utf8") > MAX_ARCHIVO_BYTES) bloqueos.push("el archivo pesa más de 2 MB");
    return { archivo: nombre, sha256: hashDocumento(texto), parsed, bloqueos, avisos: [...parsed.avisos] };
  });

  // 2) Choques dentro del propio lote.
  const vistos = new Map();
  for (const fila of filas) {
    const clave = fila.parsed.clase === "hub" ? "_hub" : fila.parsed.slug;
    if (!clave) continue;
    if (vistos.has(clave)) {
      const otro = vistos.get(clave);
      fila.bloqueos.push(`«${clave}» viene dos veces en el lote (también en ${otro})`);
      const previa = filas.find((item) => item.archivo === otro);
      if (previa) previa.bloqueos.push(`«${clave}» viene dos veces en el lote (también en ${fila.archivo})`);
      continue;
    }
    vistos.set(clave, fila.archivo);
  }

  // 3) Canibalización y rutas, en una consulta por tipo para todo el lote.
  const keywords = filas.map((fila) => fila.parsed.modulo?.focusKeyword).filter(Boolean);
  const rutas = filas.flatMap((fila) => [...(fila.parsed.enlaces || []), ...(fila.parsed.relacionados || []).map((item) => (item.startsWith("/") ? item : `/blog/${item}`))]);
  const [conflictos, estadoRutas] = await Promise.all([
    buscarCanibalizacion(keywords, { hubId: hub.id }),
    verificarRutas(rutas, { hubSlug: hub.slug, slugsDelHub }),
  ]);

  // 4) Resolución por fila.
  let posicionLibre = siguientePosicion;
  const lote = [];

  for (const fila of filas) {
    const { parsed } = fila;
    const avisos = fila.avisos;
    const bloqueos = fila.bloqueos;

    if (parsed.clase === "hub") {
      const diff = [];
      for (const [campo, valor] of Object.entries(parsed.hub || {})) {
        if (iguales(hub[campo], valor)) continue;
        diff.push({ campo: ETIQUETAS[campo] || campo, antes: recortar(Array.isArray(hub[campo]) ? hub[campo].join(", ") : hub[campo]), despues: recortar(Array.isArray(valor) ? valor.join(", ") : valor) });
      }
      lote.push({
        archivo: fila.archivo,
        sha256: fila.sha256,
        clase: "hub",
        slug: hub.slug,
        ruta: `/${hub.slug}`,
        rutaExiste: HUBS_CON_RUTA.has(hub.slug),
        accion: "actualizar",
        moduloId: null,
        diff,
        avisos,
        bloqueos,
        escribible: !bloqueos.length,
        payload: { hub: parsed.hub || {}, copy: parsed.copy || {} },
      });
      continue;
    }

    const existente = parsed.slug ? porSlug.get(parsed.slug) : null;
    const payload = acotar({ ...parsed.modulo }, avisos);

    // Cuerpo vacío: nada que crear, pero sí algo que corregir si la fila ya está.
    if (!parsed.body) {
      if (!existente) bloqueos.push("el archivo no trae cuerpo y el módulo todavía no existe: no hay nada que guardar");
      else {
        delete payload.body;
        avisos.push("se conserva el cuerpo que ya tiene el módulo");
      }
    }

    // Tipo: un módulo que el administrador marcó como CUSTOM no se convierte en
    // TOPIC porque el archivo no diga nada. El archivo no sabe de esa decisión.
    if (existente && existente.type === "CUSTOM" && payload.type !== "CUSTOM") {
      payload.type = "CUSTOM";
      avisos.push("el módulo está marcado como «contenido personalizado» y se mantiene así");
    }

    // Orden: el del archivo si viene y está libre; si choca, el siguiente libre.
    if (payload.position === null || payload.position === undefined) {
      payload.position = existente ? existente.position : posicionLibre++;
    } else {
      const dueño = posicionesTomadas.get(payload.position);
      if (dueño && dueño !== parsed.slug) {
        avisos.push(`el orden ${payload.position} ya lo tiene «${dueño}»: se usa ${posicionLibre}`);
        payload.position = posicionLibre++;
      }
    }
    posicionesTomadas.set(payload.position, parsed.slug);

    // Publicación asimétrica: `publicado: false` se aplica, `publicado: true` no.
    if (!existente) {
      payload.isPublished = false;
      payload.isVisible = true;
      if (parsed.publicado) avisos.push("«publicado: true» no publica: el módulo entra como borrador y se publica aparte");
    } else if (parsed.despublicar) {
      payload.isPublished = false;
      if (existente.isPublished) avisos.push("«publicado: false» despublica este módulo");
    } else {
      payload.isPublished = existente.isPublished;
      if (parsed.publicado && !existente.isPublished) avisos.push("«publicado: true» no publica: queda en borrador y se publica aparte");
    }

    // Metadata fusionada: lo que el archivo no dice, no se borra.
    const metaExistente = existente?.metadata && typeof existente.metadata === "object" ? existente.metadata : {};
    payload.metadata = { ...metaExistente, ...payload.metadata };

    // Canibalización, dentro y fuera del hub.
    if (payload.focusKeyword) {
      const clave = payload.focusKeyword.toLowerCase();
      for (const conflicto of conflictos.get(clave) || []) {
        bloqueos.push(`«${payload.focusKeyword}» ya la persigue ${conflicto.ruta} (${conflicto.detalle})`);
      }
      for (const otro of hub.modules) {
        if (otro.slug === parsed.slug) continue;
        if (String(otro.focusKeyword || "").toLowerCase() !== clave) continue;
        bloqueos.push(`«${payload.focusKeyword}» ya la persigue /${hub.slug}/${otro.slug} en este mismo hub`);
      }
      for (const otra of lote) {
        if (otra.clase !== "tema" || !otra.payload?.focusKeyword) continue;
        if (String(otra.payload.focusKeyword).toLowerCase() !== clave) continue;
        bloqueos.push(`«${payload.focusKeyword}» también la persigue ${otra.archivo} en este lote`);
        // El bloqueo va en las dos filas: quien importa tiene que ver el
        // conflicto en los dos archivos, no solo en el que se leyó último.
        otra.bloqueos.push(`«${payload.focusKeyword}» también la persigue ${fila.archivo} en este lote`);
        otra.escribible = false;
      }
    }

    // Enlaces del cuerpo y artículos relacionados.
    const enlaces = (parsed.enlaces || []).map((ruta) => ({ ruta, estado: estadoRutas.get(ruta) || "no verificable" }));
    for (const enlace of enlaces) {
      if (enlace.estado !== "ok") avisos.push(`el cuerpo enlaza ${enlace.ruta}: ${enlace.estado}`);
    }
    for (const item of parsed.relacionados || []) {
      const ruta = item.startsWith("/") ? item : `/blog/${item}`;
      const estado = estadoRutas.get(ruta) || "no verificable";
      if (estado !== "ok") avisos.push(`«articulos_relacionados» apunta a ${ruta}: ${estado}`);
    }

    // Herramienta relacionada contra las funciones habilitadas del hub.
    const funciones = Array.isArray(hub.enabledFunctions) ? hub.enabledFunctions : [];
    if (payload.metadata.herramienta_relacionada && funciones.length && !funciones.includes("tools")) {
      avisos.push("el hub no tiene habilitada la función «herramientas»: el bloque no se va a renderizar");
    }

    if (parsed.slug === SLUG_TRATAMIENTO) avisos.push("se guarda como módulo de tipo «tratamiento»");

    lote.push({
      archivo: fila.archivo,
      sha256: fila.sha256,
      clase: "tema",
      slug: parsed.slug,
      ruta: parsed.slug ? `/${hub.slug}/${parsed.slug}` : null,
      rutaExiste: HUBS_CON_RUTA.has(hub.slug),
      accion: existente ? "actualizar" : "crear",
      moduloId: existente?.id || null,
      publicadoActual: existente ? existente.isPublished : false,
      diff: existente ? diffModulo(existente, payload) : [{ campo: "módulo", antes: "no existe", despues: `${payload.title} · ${String(payload.body || "").length.toLocaleString("es-CR")} caracteres` }],
      enlaces,
      avisos,
      bloqueos,
      escribible: !bloqueos.length,
      payload,
    });
  }

  const resumen = {
    crear: lote.filter((fila) => fila.escribible && fila.accion === "crear").length,
    actualizar: lote.filter((fila) => fila.escribible && fila.accion === "actualizar").length,
    bloqueados: lote.filter((fila) => !fila.escribible).length,
    avisos: lote.reduce((total, fila) => total + fila.avisos.length, 0),
  };

  return {
    hub: { id: hub.id, slug: hub.slug, name: hub.name, status: hub.status, rutaExiste: HUBS_CON_RUTA.has(hub.slug) },
    lote,
    resumen,
  };
}

/**
 * Aplica el lote en una transacción. Vuelve a leerlo antes de escribir: el
 * informe que vio quien confirma se reconstruye acá, así que no hay estado
 * guardado entre las dos llamadas ni posibilidad de que se aplique algo
 * distinto de lo que se mostró.
 */
export async function aplicarLote({ hubId, archivos, actor = "" }) {
  const lectura = await leerLote({ hubId, archivos });
  if (lectura.error) return lectura;

  const escribibles = lectura.lote.filter((fila) => fila.escribible);
  if (!escribibles.length) return { ...lectura, aplicados: [], writesPerformed: false };

  const sello = { fecha: new Date().toISOString(), actor: String(actor || "") };
  const aplicados = [];

  await prisma.$transaction(async (tx) => {
    // El hub primero: si cambia su configuración, los módulos se escriben sobre
    // la fila ya actualizada.
    for (const fila of escribibles.filter((item) => item.clase === "hub")) {
      const data = { ...fila.payload.hub };
      if (Object.keys(data).length) await tx.professionalHub.update({ where: { id: hubId }, data });

      const copy = fila.payload.copy || {};
      if (Object.keys(copy).length) {
        const metadata = { copy, importacion: { archivo: fila.archivo, sha256: fila.sha256, ...sello } };
        const existente = await tx.professionalHubModule.findFirst({ where: { hubId, slug: SLUG_COPY_HUB }, select: { id: true } });
        if (existente) await tx.professionalHubModule.update({ where: { id: existente.id }, data: { metadata, title: "Copy del hub" } });
        else {
          await tx.professionalHubModule.create({
            data: {
              hubId, slug: SLUG_COPY_HUB, type: "CUSTOM", title: "Copy del hub",
              summary: "Textos de sección de _hub.md. No se renderiza como página.",
              metadata, position: 999, isVisible: false, isPublished: false,
            },
          });
        }
      }
      aplicados.push({ archivo: fila.archivo, clase: "hub", ruta: fila.ruta, accion: "actualizar", publicado: lectura.hub.status === "PUBLISHED" });
    }

    for (const fila of escribibles.filter((item) => item.clase === "tema")) {
      const data = { ...fila.payload, metadata: { ...fila.payload.metadata, importacion: { archivo: fila.archivo, sha256: fila.sha256, ...sello } } };
      if (fila.moduloId) await tx.professionalHubModule.update({ where: { id: fila.moduloId }, data });
      else await tx.professionalHubModule.create({ data: { ...data, hubId } });
      aplicados.push({ archivo: fila.archivo, clase: "tema", slug: fila.slug, ruta: fila.ruta, accion: fila.accion, publicado: data.isPublished === true });
    }
  });

  return { ...lectura, aplicados, writesPerformed: true };
}
