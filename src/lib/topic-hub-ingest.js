import { prisma } from "@/lib/prisma";
import { buscarCanibalizacion, estable, hashDocumento, iguales, verificarRutas } from "@/lib/hub-ingest";
import { MAX_ARCHIVO_BYTES, MAX_ARCHIVOS_FEED, MAX_ARCHIVOS_LOTE, MAX_LOTE_BYTES } from "@/lib/hub-markdown";
import { parseTopicHubDocument, topicSectionAnchor } from "@/lib/topic-hub-markdown";

function diffCampos(antes, despues, campos) {
  return Object.entries(campos).filter(([campo]) => despues[campo] !== undefined && !iguales(antes?.[campo], despues[campo])).map(([campo, etiqueta]) => ({
    campo: etiqueta,
    antes: campo === "body" ? `${String(antes?.[campo] || "").length} caracteres` : String(antes?.[campo] ?? "").slice(0, 180),
    despues: campo === "body" ? `${String(despues[campo] || "").length} caracteres` : String(despues[campo] ?? "").slice(0, 180),
  }));
}

function metadatosDe(seccion) {
  return seccion?.config?.ingesta?.metadatos || {};
}

export async function leerLoteContenido({ hubId, archivos, feed = false, destino = null }, db = prisma) {
  const hub = await db.topic.findUnique({ where: { id: String(hubId || "") }, include: { sections: { orderBy: [{ position: "asc" }, { id: "asc" }] }, posts: true } });
  if (!hub) return { error: "No se encontró el hub de contenido." };
  const entrada = Array.isArray(archivos) ? archivos : [];
  if (!entrada.length) return { error: "No llegó ningún archivo." };
  if (entrada.length > (feed ? MAX_ARCHIVOS_FEED : MAX_ARCHIVOS_LOTE)) return { error: "El lote supera la cantidad de archivos permitida.", motivo: "entrada" };
  if (entrada.reduce((total, a) => total + Buffer.byteLength(String(a.texto || ""), "utf8"), 0) > MAX_LOTE_BYTES) return { error: "El lote supera 3 MB.", motivo: "entrada" };
  if (destino && (entrada.length !== 1 || !hub.sections.some((s) => s.id === destino && s.config?.ingesta?.slug !== "_hub"))) return { error: "Elegí una sección existente de este hub y un solo archivo.", motivo: "destino" };

  const documentos = entrada.map((a) => ({ ...parseTopicHubDocument(a.texto, a.nombre, { feed }), archivo: a.nombre, sha256: hashDocumento(a.texto), bytes: Buffer.byteLength(a.texto, "utf8") }));
  const rutas = documentos.flatMap((d) => [...d.enlaces, ...d.relacionados.map((r) => r.startsWith("/") ? r : `/blog/${r}`)]);
  // Una sección es un ancla dentro de la página del hub, no una URL hija.
  const [rutasExistentes, keywords] = await Promise.all([
    verificarRutas(rutas, { hubSlug: hub.slug, slugsDelHub: new Set(), db }),
    buscarCanibalizacion(documentos.filter((d) => d.clase === "hub").map((d) => d.metadatos.busqueda_objetivo).filter((keyword) => typeof keyword === "string" && keyword), { hubId: null, db }),
  ]);
  const slugsArticulos = [...new Set(documentos.flatMap((d) => d.relacionados.map((r) => r.replace(/^\/blog\//, ""))))];
  const articulos = slugsArticulos.length ? await db.post.findMany({ where: { slug: { in: slugsArticulos }, status: "PUBLISHED" }, select: { id: true, slug: true } }) : [];
  const lote = [];
  let siguientePosicion = hub.sections.filter((s) => s.config?.ingesta?.slug !== "_hub").reduce((max, s) => Math.max(max, s.position + 1), 0);
  for (const doc of documentos) {
    const bloqueos = [...doc.bloqueos];
    const avisos = [...doc.avisos];
    if (doc.bytes > MAX_ARCHIVO_BYTES) bloqueos.push("el archivo pesa más de 2 MB");
    let existentes = hub.sections.filter((s) => s.config?.ingesta?.slug === doc.slug);
    const idElegido = destino || doc.seccionId;
    if (idElegido) {
      if (doc.clase === "hub") bloqueos.push("_hub.md no puede dirigirse a una sección");
      existentes = hub.sections.filter((s) => s.id === idElegido && s.config?.ingesta?.slug !== "_hub");
      if (!existentes.length) bloqueos.push("la sección elegida no pertenece a este hub");
      if (existentes[0]?.config?.ingesta?.slug) doc.slug = existentes[0].config.ingesta.slug;
    } else if (!existentes.length && doc.clase === "seccion" && doc.payload.type) {
      // Adopta una sección histórica solo si el tipo identifica un único destino.
      existentes = hub.sections.filter((s) => s.type === doc.payload.type && !s.config?.ingesta?.slug);
    }
    if (existentes.length > 1) bloqueos.push("hay varias secciones posibles; elegí el destino o indicá seccion_id");
    const existente = existentes.length === 1 ? existentes[0] : null;
    const metadatos = { ...metadatosDe(existente), ...doc.metadatos };
    const payload = { ...doc.payload };
    const diff = [];
    if (doc.clase === "hub") {
      diff.push(...diffCampos(hub, payload, { name: "nombre", title: "título", subtitle: "subtítulo", excerpt: "resumen", metaTitle: "título SEO", metaDescription: "meta descripción", heroImage: "imagen hero", heroImageAlt: "texto alternativo", introVideoUrl: "video", podcastUrl: "podcast", order: "orden del hub", featured: "hub destacado" }));
      const keyword = String(metadatos.busqueda_objetivo || "").toLowerCase();
      for (const conflicto of keywords.get(keyword) || []) if (conflicto.topicId !== hub.id) bloqueos.push(`«${metadatos.busqueda_objetivo}» ya la persigue ${conflicto.ruta}`);
    } else {
      payload.type ??= existente?.type || "CUSTOM_RICH_TEXT";
      payload.position ??= existente?.position ?? siguientePosicion++;
      payload.isVisible = existente ? existente.isVisible : hub.status !== "PUBLISHED";
      if (!existente && !payload.title) bloqueos.push("una sección nueva necesita «titulo»");
      if (!existente && !payload.body && ["CUSTOM_RICH_TEXT", "EDITORIAL_INTRO", "USER_SITUATIONS"].includes(payload.type)) bloqueos.push("una sección de texto nueva necesita cuerpo");
      for (const otra of hub.sections.filter((s) => s.id !== existente?.id && s.config?.ingesta?.slug !== "_hub" && s.position === payload.position)) bloqueos.push(`el orden ${payload.position} de «${doc.slug}» ya lo tiene «${otra.title || otra.type}» (${otra.id})`);
      if (payload.type !== "CUSTOM_RICH_TEXT" && hub.sections.some((s) => s.type === payload.type && s.id !== existente?.id)) bloqueos.push(`ya existe otra sección de tipo ${payload.type}; elegí su destino para actualizarla`);
      diff.push(...diffCampos(existente, payload, { title: "título", body: "cuerpo", type: "tipo de sección", position: "orden" }));
      avisos.push(`se importa como sección de /${hub.slug}`);
      if (!existente && !payload.isVisible) avisos.push("la sección nueva queda oculta hasta activarla manualmente en el editor");
    }
    for (const [campo, valor] of Object.entries(doc.metadatos)) if (!iguales(metadatosDe(existente)[campo], valor)) diff.push({ campo, antes: estable(metadatosDe(existente)[campo])?.slice(0, 180) || "", despues: estable(valor)?.slice(0, 180) || "" });
    const enlaces = doc.enlaces.map((ruta) => ({ ruta, estado: ruta.replace(/[?#].*$/, "") === `/${hub.slug}` ? "ok" : rutasExistentes.get(ruta) || "no verificable" }));
    for (const enlace of enlaces) if (enlace.estado !== "ok") bloqueos.push(`el cuerpo enlaza ${enlace.ruta}: ${enlace.estado}`);
    const vinculos = [];
    for (const ruta of doc.relacionados) {
      const articulo = articulos.find((a) => a.slug === ruta.replace(/^\/blog\//, ""));
      if (!articulo) bloqueos.push(`el artículo relacionado «${ruta}» no existe publicado`);
      else if (!hub.posts.some((p) => p.postId === articulo.id && p.status === "APPROVED")) {
        vinculos.push(articulo);
        diff.push({ campo: "artículo relacionado", antes: "sin vínculo aprobado", despues: `/blog/${articulo.slug}` });
      }
    }
    let accion = existente || doc.clase === "hub" ? "actualizar" : "crear";
    if (!diff.length) accion = "sin_cambios";
    lote.push({
      archivo: doc.archivo,
      sha256: doc.sha256,
      clase: doc.clase,
      slug: doc.slug,
      ruta: doc.clase === "hub" ? `/${hub.slug}` : `/${hub.slug}#${topicSectionAnchor(payload.type, doc.slug)}`,
      rutaExiste: true,
      moduloId: existente?.id || null,
      publicadoActual: hub.status === "PUBLISHED" && (doc.clase === "hub" || existente?.isVisible),
      accion,
      payload,
      metadatos,
      vinculos,
      diff,
      enlaces,
      avisos,
      bloqueos,
    });
  }
  for (const fila of lote) {
    for (const otra of lote) {
      if (otra === fila) continue;
      if (otra.slug === fila.slug || fila.moduloId && fila.moduloId === otra.moduloId) fila.bloqueos.push(`el destino también aparece en ${otra.archivo}`);
      if (fila.clase !== "seccion" || otra.clase !== "seccion") continue;
      if (fila.payload.position === otra.payload.position) fila.bloqueos.push(`el orden ${fila.payload.position} también lo solicita ${otra.archivo}`);
      if (fila.payload.type !== "CUSTOM_RICH_TEXT" && fila.payload.type === otra.payload.type) fila.bloqueos.push(`el tipo ${fila.payload.type} también lo solicita ${otra.archivo}`);
    }
    fila.escribible = !fila.bloqueos.length && fila.accion !== "sin_cambios";
  }
  return {
    hub: { id: hub.id, slug: hub.slug, name: hub.name, status: hub.status, rutaExiste: true },
    revision: hashDocumento(estable({ hub, feed, destino, tipoHub: "contenido" })),
    lote,
    resumen: {
      crear: lote.filter((fila) => fila.escribible && fila.accion === "crear").length,
      actualizar: lote.filter((fila) => fila.escribible && fila.accion === "actualizar").length,
      sinCambios: lote.filter((fila) => !fila.bloqueos.length && fila.accion === "sin_cambios").length,
      bloqueados: lote.filter((fila) => fila.bloqueos.length).length,
      avisos: lote.reduce((total, fila) => total + fila.avisos.length, 0),
    },
  };
}

export async function aplicarLoteContenido({ hubId, archivos, feed = false, destino = null, revision, actor = "" }) {
  return prisma.$transaction(async (tx) => {
    const lectura = await leerLoteContenido({ hubId, archivos, feed, destino }, tx);
    if (lectura.error) return lectura;
    if (revision !== lectura.revision) return { error: "El hub cambió después de la vista previa. Volvé a revisar el feed.", motivo: "revision" };
    const aplicados = [];
    for (const fila of lectura.lote.filter((f) => f.escribible)) {
      const anterior = fila.moduloId ? await tx.topicSection.findUnique({ where: { id: fila.moduloId }, select: { config: true } }) : null;
      const config = { ...anterior?.config, ingesta: { ...anterior?.config?.ingesta, slug: fila.slug, metadatos: fila.metadatos }, importacion: { archivo: fila.archivo, sha256: fila.sha256, fecha: new Date().toISOString(), actor } };
      if (fila.clase === "hub") {
        if (Object.keys(fila.payload).length) await tx.topic.update({ where: { id: hubId }, data: fila.payload });
        // Fila técnica invisible para conservar los metadatos de portada sin
        // alterar el schema ni reemplazar secciones editoriales.
        if (fila.moduloId) await tx.topicSection.update({ where: { id: fila.moduloId }, data: { config } });
        else await tx.topicSection.create({ data: { topicId: hubId, type: "CUSTOM_RICH_TEXT", title: "_hub", position: 0, isVisible: false, config } });
      } else {
        const data = { ...fila.payload, config };
        if (fila.moduloId) await tx.topicSection.update({ where: { id: fila.moduloId }, data });
        else await tx.topicSection.create({ data: { ...data, topicId: hubId } });
      }
      for (const articulo of fila.vinculos) await tx.postTopic.upsert({ where: { postId_topicId: { postId: articulo.id, topicId: hubId } }, create: { postId: articulo.id, topicId: hubId, status: "APPROVED", role: "SUPPORTING" }, update: { status: "APPROVED" } });
      aplicados.push({ archivo: fila.archivo, clase: fila.clase, accion: fila.accion, ruta: fila.ruta, publicado: Boolean(fila.publicadoActual) });
    }
    return { ...lectura, aplicados, writesPerformed: aplicados.length > 0 };
  }, { isolationLevel: "Serializable", timeout: 15000 });
}
