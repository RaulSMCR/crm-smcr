import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  MAX_ARCHIVOS_LOTE,
  MAX_ARCHIVOS_FEED,
  MAX_LOTE_BYTES,
  MAX_ARCHIVO_BYTES,
  SLUG_COPY_HUB,
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

export { SLUG_COPY_HUB };

/**
 * Rutas que son carpetas en `src/app/` y por lo tanto existen siempre.
 *
 * Solo páginas reales: reservar un segmento como api u og no significa que
 * exista una página pública en esa ruta.
 */
const RUTAS_ESTATICAS = new Set([
  "blog", "cambiar-password", "contacto", "cookies", "espera-aprobacion",
  "faq", "ingresar", "mi", "panel", "profesionales", "privacidad", "recuperar",
  "registro", "servicios", "terminos", "verificar-email", "ayuda-inmediata",
  "raul-olmedo-evans", "raul-olmedo", "ayuda/seguros", "registro/usuario", "registro/profesional",
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

/** Los mismos nombres que muestra el selector «Tipo / función» del panel. */
const ETIQUETAS_TIPO = { TOPIC: "tema", TREATMENT: "tratamiento", CUSTOM: "contenido personalizado" };

export function hashDocumento(texto) {
  return createHash("sha256").update(String(texto || ""), "utf8").digest("hex");
}

function recortar(valor, max = 120) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}

export function iguales(a, b) {
  if (typeof a === "object" && a !== null || typeof b === "object" && b !== null) return estable(a ?? []) === estable(b ?? []);
  const normal = (valor) => (valor === null || valor === undefined ? "" : String(valor));
  return normal(a) === normal(b);
}

export function estable(valor) {
  return JSON.stringify(valor, (_, v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
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
  isFeatured: "destacada",
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

  for (const campo of ["title", "summary", "metaTitle", "metaDescription", "focusKeyword", "ogImage", "noindex", "position", "type", "isFeatured"]) {
    if (payload[campo] === undefined) continue;
    if (iguales(existente?.[campo] ?? (["noindex", "isFeatured"].includes(campo) ? false : null), payload[campo])) continue;
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
export async function buscarCanibalizacion(keywords, { hubId, db = prisma }) {
  const buscadas = [...new Set(keywords.filter(Boolean).map((item) => item.toLowerCase()))];
  if (!buscadas.length) return new Map();

  // Un OR de `equals` insensibles en lugar de `in`: Prisma no aplica
  // `mode: "insensitive"` dentro de `in`, así que con `in` una diferencia de
  // mayúsculas dejaría pasar el conflicto.
  const comoSea = buscadas.map((keyword) => ({ focusKeyword: { equals: keyword, mode: "insensitive" } }));

  const [modulos, hubs, posts, servicios, profesionales, portadasContenido] = await Promise.all([
    db.professionalHubModule.findMany({
      where: { OR: comoSea },
      select: { id: true, slug: true, focusKeyword: true, hubId: true, isPublished: true, hub: { select: { slug: true } } },
    }),
    db.professionalHub.findMany({
      where: { OR: comoSea },
      select: { id: true, slug: true, focusKeyword: true, status: true },
    }),
    db.post.findMany({
      where: { OR: comoSea, status: "PUBLISHED" },
      select: { slug: true, focusKeyword: true },
    }),
    db.service.findMany({
      where: { OR: comoSea, isActive: true },
      select: { slug: true, focusKeyword: true },
    }),
    db.professionalProfile.findMany({ where: { OR: comoSea, isApproved: true, user: { is: { isActive: true } } }, select: { slug: true, focusKeyword: true } }),
    db.topicSection.findMany({ where: { config: { path: ["ingesta", "slug"], equals: "_hub" } }, select: { topicId: true, config: true, topic: { select: { slug: true, status: true } } } }),
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
  for (const p of profesionales) agregar(p.focusKeyword, `/profesionales/${p.slug}`, "perfil profesional");
  for (const portada of portadasContenido) {
    const keyword = portada.config?.ingesta?.metadatos?.busqueda_objetivo;
    if (!keyword || !buscadas.includes(String(keyword).toLowerCase())) continue;
    const clave = String(keyword).toLowerCase();
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push({ ruta: `/${portada.topic.slug}`, detalle: "hub de contenido", topicId: portada.topicId });
  }

  // Los conflictos dentro del propio hub se resuelven aparte, comparando contra
  // los módulos que ya están en la fila (ver `leerLote`), porque ahí sí hace
  // falta saber si el que choca es el que se está reemplazando.
  return mapa;
}

/**
 * Verifica rutas internas: artículos, series, servicios, temas, módulos del hub
 * y rutas fijas.
 *
 * Las series (`/blog/serie/<slug>`) caían en «no verificable», y es justo el
 * enlace que se rompió en la pieza de ansiedad: el cuerpo nombraba la serie «La
 * angustia y sus formas» y enlazaba `/angustia`. Una serie cuenta como publicada
 * con el mismo criterio de su página y de `getFeaturedSeries`: activa y con al
 * menos una entrega publicada y aprobada.
 */
export async function verificarRutas(rutas, { hubSlug, slugsDelHub, db = prisma }) {
  const pendientes = [...new Set(rutas.filter(Boolean))];
  if (!pendientes.length) return new Map();

  const slugsBlog = [];
  const slugsSerie = [];
  const slugsServicio = [];
  const slugsRaiz = [];
  const slugsProfesional = [];
  const slugsHubProfesional = new Set();
  for (const ruta of pendientes) {
    const partes = ruta.replace(/[?#].*$/, "").split("/").filter(Boolean);
    if (partes.length === 2 && partes[0] === "blog") slugsBlog.push(partes[1]);
    else if (partes.length === 3 && partes[0] === "blog" && partes[1] === "serie") slugsSerie.push(partes[2]);
    else if (partes.length === 2 && partes[0] === "servicios") slugsServicio.push(partes[1]);
    else if (partes.length === 2 && partes[0] === "profesionales") slugsProfesional.push(partes[1]);
    else if (partes.length === 1) slugsRaiz.push(partes[0]);
    else if (partes.length === 0) continue;
    else if (partes[0] === hubSlug) continue;
    else if (partes.length === 2) slugsHubProfesional.add(partes[0] === "raul-olmedo" ? "raul-olmedo-evans" : partes[0]);
  }

  const [posts, series, servicios, temas, profesionales, hubsProfesionales] = await Promise.all([
    slugsBlog.length
      ? db.post.findMany({ where: { slug: { in: slugsBlog }, status: "PUBLISHED" }, select: { slug: true } })
      : [],
    slugsSerie.length
      ? db.series.findMany({
          where: { slug: { in: slugsSerie }, isActive: true, posts: { some: { status: "PUBLISHED", seriesApproved: true } } },
          select: { slug: true },
        })
      : [],
    slugsServicio.length
      ? db.service.findMany({ where: { slug: { in: slugsServicio }, isActive: true }, select: { slug: true } })
      : [],
    slugsRaiz.length
      ? db.topic.findMany({ where: { slug: { in: slugsRaiz }, status: "PUBLISHED", isActive: true }, select: { slug: true } })
      : [],
    slugsProfesional.length ? db.professionalProfile.findMany({ where: { slug: { in: slugsProfesional }, isApproved: true, user: { is: { isActive: true } } }, select: { slug: true } }) : [],
    slugsHubProfesional.size ? db.professionalHub.findMany({
      where: { slug: { in: [...slugsHubProfesional] } },
      select: { slug: true, status: true, isActive: true, modules: { select: { slug: true, isPublished: true, isVisible: true } } },
    }) : [],
  ]);

  const publicados = {
    blog: new Set(posts.map((item) => item.slug)),
    series: new Set(series.map((item) => item.slug)),
    servicios: new Set(servicios.map((item) => item.slug)),
    raiz: new Set(temas.map((item) => item.slug)),
    profesionales: new Set(profesionales.map((item) => item.slug)),
    hubsProfesionales: new Map(hubsProfesionales.map((hub) => [hub.slug, hub])),
  };

  const mapa = new Map();
  for (const ruta of pendientes) {
    const partes = ruta.replace(/[?#].*$/, "").split("/").filter(Boolean);
    if (RUTAS_ESTATICAS.has(partes.join("/"))) { mapa.set(ruta, "ok"); continue; }
    if (!partes.length) {
      mapa.set(ruta, "ok");
      continue;
    }
    if (partes.length === 2 && partes[0] === "blog") {
      mapa.set(ruta, publicados.blog.has(partes[1]) ? "ok" : "no existe publicado");
      continue;
    }
    if (partes.length === 3 && partes[0] === "blog" && partes[1] === "serie") {
      mapa.set(ruta, publicados.series.has(partes[2]) ? "ok" : "no existe publicada");
      continue;
    }
    if (partes.length === 2 && partes[0] === "servicios") {
      mapa.set(ruta, publicados.servicios.has(partes[1]) ? "ok" : "no existe activo");
      continue;
    }
    if (partes.length === 2 && partes[0] === "profesionales") {
      mapa.set(ruta, publicados.profesionales.has(partes[1]) ? "ok" : "no existe publicado");
      continue;
    }
    if (partes.length === 2 && partes[0] === hubSlug) {
      mapa.set(ruta, slugsDelHub.has(partes[1]) ? "ok" : "no existe en este hub");
      continue;
    }
    if (partes.length === 2) {
      const slugHub = partes[0] === "raul-olmedo" ? "raul-olmedo-evans" : partes[0];
      const hubDestino = publicados.hubsProfesionales.get(slugHub);
      if (HUBS_CON_RUTA.has(slugHub)) {
        const modulo = hubDestino?.modules?.find((item) => item.slug === partes[1]);
        let estado = "el hub de destino no existe publicado";
        if (hubDestino && hubDestino.status === "PUBLISHED" && hubDestino.isActive) {
          estado = modulo?.isPublished && modulo.isVisible ? "ok" : "el módulo de destino no existe publicado y visible";
        }
        mapa.set(ruta, estado);
        continue;
      }
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
 * @param {string|null} [entrada.destino] slug del módulo elegido en el panel.
 *   Cuando viene, el nombre del archivo deja de decidir la página: se escribe en
 *   ese módulo y punto. Solo con un archivo en el lote —«este archivo va a este
 *   módulo» no significa nada si hay cinco archivos— y solo sobre un módulo que
 *   ya existe: crear se sigue haciendo por nombre de archivo, que es donde el
 *   slug queda dicho una sola vez y en un lugar.
 */
export async function leerLote({ hubId, archivos, destino = null, feed = false }, db = prisma) {
  const hub = await db.professionalHub.findUnique({
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
  const maxArchivos = feed ? MAX_ARCHIVOS_FEED : MAX_ARCHIVOS_LOTE;
  if (entrada.length > maxArchivos) return { error: `Máximo ${maxArchivos} archivos por lote.` };
  if (entrada.reduce((total, archivo) => total + Buffer.byteLength(String(archivo?.texto || ""), "utf8"), 0) > MAX_LOTE_BYTES) return { error: "El lote supera 3 MB. Dividí la carpeta antes de continuar." };

  const porSlug = new Map(hub.modules.map((modulo) => [modulo.slug, modulo]));
  const slugsDelHub = new Set(hub.modules.filter((m) => !feed || m.isPublished && m.isVisible).map((modulo) => modulo.slug));
  const siguientePosicion = hub.modules.reduce((max, modulo) => Math.max(max, modulo.position + 1), 0);

  // 0) El módulo elegido, si lo hay. Se valida contra la fila antes de parsear:
  // un destino que no existe es un error de la pantalla, no del archivo, y
  // mezclarlo con los bloqueos del documento lo haría parecer culpa del texto.
  const slugDestino = String(destino || "").trim() || null;
  if (slugDestino) {
    if (entrada.length > 1) {
      return { error: "Con un módulo elegido se importa un archivo por vez.", motivo: "destino" };
    }
    if (slugDestino === SLUG_COPY_HUB) {
      return { error: "El copy del hub se escribe con «_hub.md», no eligiéndolo como módulo.", motivo: "destino" };
    }
    if (!porSlug.has(slugDestino)) {
      return { error: `Este hub no tiene un módulo «${slugDestino}».`, motivo: "destino" };
    }
  }

  // 1) Parseo puro de cada archivo.
  const filas = entrada.map((archivo, indice) => {
    const nombre = String(archivo?.nombre || `archivo-${indice + 1}.md`);
    const texto = String(archivo?.texto ?? "");
    const parsed = parseHubDocument(texto, nombre, { slug: slugDestino, feed });
    const bloqueos = [...parsed.bloqueos];
    if (feed && !/\.md$/i.test(nombre)) bloqueos.push("el feed solo acepta archivos .md");
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
  if (feed) for (const fila of filas) if (fila.parsed.clase === "tema" && fila.parsed.slug) slugsDelHub.add(fila.parsed.slug);
  const keywords = filas.map((fila) => fila.parsed.modulo?.focusKeyword || fila.parsed.hub?.focusKeyword).filter(Boolean);
  const rutas = filas.flatMap((fila) => [...(fila.parsed.enlaces || []), ...(fila.parsed.relacionados || []).map((item) => (item.startsWith("/") ? item : `/blog/${item}`))]);
  const [conflictos, estadoRutas] = await Promise.all([
    buscarCanibalizacion(keywords, { hubId: hub.id, db }),
    verificarRutas(rutas, { hubSlug: hub.slug, slugsDelHub, db }),
  ]);

  // 4) Resolución por fila.
  let posicionLibre = siguientePosicion;
  const lote = [];

  for (const fila of filas) {
    const { parsed } = fila;
    const avisos = fila.avisos;
    const bloqueos = fila.bloqueos;

    if (parsed.clase === "hub") {
      // Configuración del hub con un módulo elegido: no se adivina cuál de las
      // dos intenciones vale. Se bloquea y se dice cómo resolverlo.
      if (slugDestino) {
        bloqueos.push(`este archivo es configuración del hub («_hub.md» o «tipo: hub») y no se puede escribir en el módulo «${slugDestino}»`);
      }
      const diff = [];
      for (const [campo, valor] of Object.entries(parsed.hub || {})) {
        if (iguales(hub[campo], valor)) continue;
        diff.push({ campo: ETIQUETAS[campo] || campo, antes: recortar(Array.isArray(hub[campo]) ? hub[campo].join(", ") : hub[campo]), despues: recortar(Array.isArray(valor) ? valor.join(", ") : valor) });
      }
      const copyAnterior = porSlug.get(SLUG_COPY_HUB)?.metadata?.copy || {};
      for (const [campo, valor] of Object.entries(parsed.copy || {})) {
        if (!iguales(copyAnterior[campo], valor)) diff.push({ campo: `copy.${campo}`, antes: recortar(estable(copyAnterior[campo])), despues: recortar(estable(valor)) });
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
    const payload = feed ? { ...parsed.modulo } : acotar({ ...parsed.modulo }, avisos);
    if (feed) for (const [campo, max] of Object.entries(LIMITES_COLUMNA)) {
      if (typeof payload[campo] === "string" && payload[campo].length > max) bloqueos.push(`«${ETIQUETAS[campo] || campo}» supera ${max} caracteres; no se recorta el contenido del feed`);
    }

    // Cuerpo vacío: nada que crear, pero sí algo que corregir si la fila ya está.
    if (!parsed.body) {
      if (!existente) bloqueos.push("el archivo no trae cuerpo y el módulo todavía no existe: no hay nada que guardar");
      else {
        delete payload.body;
        avisos.push("se conserva el cuerpo que ya tiene el módulo");
      }
    }

    // Sin tipo explícito se conserva el que eligió el administrador.
    if (existente && existente.type && !parsed.tipoExplicito && payload.type !== existente.type) {
      avisos.push(`el módulo está marcado como «${ETIQUETAS_TIPO[existente.type] || existente.type}» y se mantiene así`);
      payload.type = existente.type;
    }

    // Nunca se desplaza otra pieza para hacerle espacio al archivo.
    if (payload.position === null || payload.position === undefined) {
      payload.position = existente ? existente.position : posicionLibre++;
    } else {
      for (const dueño of hub.modules.filter((m) => m.position === payload.position && m.slug !== parsed.slug)) {
        bloqueos.push(`el orden ${payload.position} de «${parsed.slug}» ya lo tiene «${dueño.title}» (/${hub.slug}/${dueño.slug})`);
      }
    }

    // Publicación manual: ningún valor del archivo cambia el estado existente.
    if (!existente) {
      payload.isPublished = false;
      payload.isVisible = true;
    } else {
      payload.isPublished = existente.isPublished;
    }
    if (parsed.publicado || parsed.despublicar) avisos.push("«publicado» se ignora: importar no publica ni despublica; el estado se cambia manualmente");

    // Metadata fusionada: lo que el archivo no dice, no se borra.
    const metaExistente = existente?.metadata && typeof existente.metadata === "object" ? existente.metadata : {};
    payload.metadata = { ...metaExistente, ...payload.metadata };

    // Canibalización, dentro y fuera del hub.
    if (payload.focusKeyword) {
      const clave = payload.focusKeyword.toLowerCase();
      for (const conflicto of conflictos.get(clave) || []) {
        bloqueos.push(`«${payload.focusKeyword}» ya la persigue ${conflicto.ruta} (${conflicto.detalle})`);
      }
      const keywordPortada = filas.find((f) => f.parsed.clase === "hub")?.parsed.hub?.focusKeyword || hub.focusKeyword;
      if (String(keywordPortada || "").toLowerCase() === clave) bloqueos.push(`«${payload.focusKeyword}» ya la persigue la portada /${hub.slug}`);
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
      if (enlace.estado !== "ok") (feed ? bloqueos : avisos).push(`el cuerpo enlaza ${enlace.ruta}: ${enlace.estado}`);
    }
    for (const item of parsed.relacionados || []) {
      const ruta = item.startsWith("/") ? item : `/blog/${item}`;
      const estado = estadoRutas.get(ruta) || "no verificable";
      if (estado !== "ok") (feed ? bloqueos : avisos).push(`«articulos_relacionados» apunta a ${ruta}: ${estado}`);
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

  // Conflictos de lote simétricos: ninguna fila gana por haber llegado primero.
  for (const fila of lote) {
    if (fila.clase !== "tema") continue;
    for (const otra of lote) {
      if (otra === fila || otra.clase !== "tema" || otra.slug === fila.slug) continue;
      if (otra.payload.position === fila.payload.position) fila.bloqueos.push(`el orden ${fila.payload.position} de «${fila.slug}» también lo pide «${otra.slug}» (${otra.archivo})`);
      if (fila.payload.isFeatured === true && otra.payload.isFeatured === true) fila.bloqueos.push(`«${fila.slug}» y «${otra.slug}» solicitan destacada: true; solo se permite una`);
    }
    if (fila.payload.isFeatured === true) {
      for (const otra of hub.modules.filter((m) => m.isFeatured && m.slug !== fila.slug)) fila.bloqueos.push(`la pieza destacada ya es /${hub.slug}/${otra.slug}; cambiá el destaque manualmente antes de importar`);
    }
  }
  for (const fila of lote.filter((f) => f.clase === "hub")) {
    const clave = fila.payload.hub.focusKeyword;
    if (!clave) continue;
    for (const c of conflictos.get(clave.toLowerCase()) || []) fila.bloqueos.push(`«${clave}» ya la persigue ${c.ruta}`);
    for (const m of hub.modules) if (String(m.focusKeyword || "").toLowerCase() === clave.toLowerCase()) fila.bloqueos.push(`«${clave}» ya la persigue /${hub.slug}/${m.slug}`);
    for (const otra of lote.filter((f) => f.clase === "tema" && String(f.payload.focusKeyword || "").toLowerCase() === clave.toLowerCase())) fila.bloqueos.push(`«${clave}» también la persigue ${otra.ruta}`);
  }
  // Un enlace a otra entrada cuenta si esa entrada puede importarse. Propaga
  // bloqueos transitivos, sin aceptar módulos ocultos o borradores ajenos al feed.
  if (feed) {
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (const fila of lote.filter((f) => f.clase === "tema" && !f.bloqueos.length)) {
        const rutasFila = [...(fila.enlaces || []).map((e) => e.ruta), ...(fila.payload.metadata.articulos_relacionados || []).map((r) => r.startsWith("/") ? r : `/blog/${r}`)];
        for (const ruta of rutasFila) {
          const partes = ruta.replace(/[?#].*$/, "").split("/").filter(Boolean);
          if (partes.length !== 2 || partes[0] !== hub.slug) continue;
          const previo = porSlug.get(partes[1]);
          if (previo?.isPublished && previo?.isVisible) continue;
          const destinos = lote.filter((f) => f.clase === "tema" && f.slug === partes[1]);
          if (destinos.length && destinos.every((d) => d.bloqueos.length)) {
            fila.bloqueos.push(`el enlace ${ruta} depende de una pieza bloqueada del feed`);
            cambio = true;
          }
        }
      }
    }
  }
  for (const fila of lote) {
    fila.accion = fila.accion === "actualizar" && !fila.diff.length ? "sin_cambios" : fila.accion;
    fila.escribible = !fila.bloqueos.length && fila.accion !== "sin_cambios";
  }
  const resumen = {
    crear: lote.filter((fila) => fila.escribible && fila.accion === "crear").length,
    actualizar: lote.filter((fila) => fila.escribible && fila.accion === "actualizar").length,
    sinCambios: lote.filter((fila) => !fila.bloqueos.length && fila.accion === "sin_cambios").length,
    bloqueados: lote.filter((fila) => fila.bloqueos.length).length,
    avisos: lote.reduce((total, fila) => total + fila.avisos.length, 0),
  };

  return {
    revision: hashDocumento(estable({ hub, feed, destino: slugDestino })),
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
export async function aplicarLote({ hubId, archivos, destino = null, feed = false, revision = null, actor = "" }) {
  return prisma.$transaction(async (tx) => {
    const lectura = await leerLote({ hubId, archivos, destino, feed }, tx);
    if (lectura.error) return lectura;
    if (revision && revision !== lectura.revision) return { error: "El hub cambió después de la vista previa. Volvé a leer la carpeta o los archivos para revisar las diferencias.", motivo: "revision" };

    const escribibles = lectura.lote.filter((fila) => fila.escribible);
    if (!escribibles.length) return { ...lectura, aplicados: [], writesPerformed: false };

    const sello = { fecha: new Date().toISOString(), actor: String(actor || "") };
    const aplicados = [];

    // El hub primero: si cambia su configuración, los módulos se escriben sobre
    // la fila ya actualizada.
    for (const fila of escribibles.filter((item) => item.clase === "hub")) {
      const data = { ...fila.payload.hub };
      if (Object.keys(data).length) await tx.professionalHub.update({ where: { id: hubId }, data });

      const copy = fila.payload.copy || {};
      if (Object.keys(copy).length) {
        const existente = await tx.professionalHubModule.findFirst({ where: { hubId, slug: SLUG_COPY_HUB }, select: { id: true, metadata: true } });
        const metadata = { ...existente?.metadata, copy: { ...existente?.metadata?.copy, ...copy }, importacion: { archivo: fila.archivo, sha256: fila.sha256, ...sello } };
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
    return { ...lectura, aplicados, writesPerformed: true };
  }, { isolationLevel: "Serializable", timeout: 15000 });
}
