import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ hub: null, escrituras: [], articulos: [], portadas: [], hubsProfesionales: [] }));
vi.mock("@/lib/prisma", () => {
  const db = {
    topic: {
      findUnique: vi.fn(async () => estado.hub),
      findMany: vi.fn(async () => []),
      update: vi.fn(async ({ data }) => { estado.escrituras.push({ tabla: "hub", data }); Object.assign(estado.hub, data); }),
    },
    topicSection: {
      findMany: vi.fn(async () => estado.portadas),
      findUnique: vi.fn(async ({ where }) => estado.hub.sections.find((s) => s.id === where.id)),
      create: vi.fn(async ({ data }) => {
        const seccion = { id: `nueva-${estado.hub.sections.length}`, ...data };
        estado.hub.sections.push(seccion);
        estado.escrituras.push({ tabla: "seccion", data });
        return seccion;
      }),
      update: vi.fn(async ({ where, data }) => { estado.escrituras.push({ tabla: "seccion", data }); Object.assign(estado.hub.sections.find((s) => s.id === where.id), data); }),
    },
    post: { findMany: vi.fn(async () => estado.articulos) },
    postTopic: { upsert: vi.fn(async ({ create, update, where }) => {
      estado.escrituras.push({ tabla: "relacion", create, update });
      const existente = estado.hub.posts.find((p) => p.postId === where.postId_topicId.postId);
      if (existente) Object.assign(existente, update);
      else estado.hub.posts.push(create);
    }) },
    professionalHub: { findMany: vi.fn(async () => estado.hubsProfesionales) },
    professionalHubModule: { findMany: vi.fn(async () => []) },
    professionalProfile: { findMany: vi.fn(async () => []) },
    service: { findMany: vi.fn(async () => []) },
    series: { findMany: vi.fn(async () => []) },
  };
  db.$transaction = vi.fn(async (fn) => fn(db));
  return { prisma: db };
});

import { aplicarLoteContenido, leerLoteContenido } from "@/lib/topic-hub-ingest";
import { parseTopicHubDocument, topicHubSeo, topicCustomSections } from "@/lib/topic-hub-markdown";

const archivo = (nombre, campos = "", cuerpo = "## Texto\n\nContenido.") => ({ nombre, texto: `---\n${campos}\n---\n\n${cuerpo}` });
const seccion = (extra = {}) => ({ id: "existente", topicId: "hub", type: "EDITORIAL_INTRO", title: "Introducción", body: "Texto anterior", position: 2, isVisible: true, config: { notas: "conservar" }, ...extra });
const leer = (archivos, extra = {}) => leerLoteContenido({ hubId: "hub", archivos, feed: true, ...extra });
async function aplicar(archivos, extra = {}) {
  const preview = await leer(archivos, extra);
  return aplicarLoteContenido({ hubId: "hub", archivos, feed: true, revision: preview.revision, actor: "admin", ...extra });
}
beforeEach(() => {
  estado.hub = { id: "hub", slug: "ansiedad", name: "Ansiedad", title: "Ansiedad", status: "DRAFT", sections: [], posts: [] };
  estado.escrituras = [];
  estado.articulos = [];
  estado.portadas = [];
  estado.hubsProfesionales = [];
});

describe("feed de hubs de contenido", () => {
  it("importa portada y secciones de un hub nuevo y la segunda corrida no escribe", async () => {
    const archivos = [archivo("_hub.md", "tipo: hub\ntitulo: Comprender la ansiedad\nno_indexar: true\nimagen_social: /images/hub.png", ""), archivo("introduccion.md", "titulo: Introducción\ntipo_seccion: EDITORIAL_INTRO\norden: 2"), archivo("lectura.md", "titulo: Otra lectura\norden: 3")];
    const previo = await leer(archivos);
    expect(previo.resumen.bloqueados).toBe(0);
    expect(estado.escrituras).toEqual([]);
    const primera = await aplicar(archivos);
    expect(primera.writesPerformed).toBe(true);
    expect(estado.hub.status).toBe("DRAFT");
    expect(topicHubSeo(estado.hub.sections)).toMatchObject({ noindex: true, ogImage: "/images/hub.png" });
    const sellos = estado.hub.sections.map((s) => s.config.importacion);
    estado.escrituras = [];
    const segunda = await aplicar(archivos);
    expect(segunda.resumen.sinCambios).toBe(3);
    expect(segunda.writesPerformed).toBe(false);
    expect(estado.escrituras).toEqual([]);
    expect(estado.hub.sections.map((s) => s.config.importacion)).toEqual(sellos);
  });
  it("actualiza una sección histórica sin perder config ni publicación", async () => {
    estado.hub.status = "PUBLISHED";
    estado.hub.sections = [seccion()];
    const r = await aplicar([archivo("introduccion-editorial.md", "titulo: Introducción actualizada\npublicado: false")]);
    expect(r.lote[0].moduloId).toBe("existente");
    expect(estado.hub.sections).toHaveLength(1);
    expect(estado.hub.sections[0]).toMatchObject({ title: "Introducción actualizada", isVisible: true, config: { notas: "conservar", ingesta: { slug: "introduccion-editorial" } } });
    expect(estado.hub.status).toBe("PUBLISHED");
  });
  it("las secciones nuevas quedan ocultas en un hub ya publicado", async () => {
    estado.hub.status = "PUBLISHED";
    const r = await aplicar([archivo("otra.md", "titulo: Otra sección\npublicado: true")]);
    expect(r.writesPerformed).toBe(true);
    expect(estado.hub.sections[0].isVisible).toBe(false);
    expect(estado.hub.status).toBe("PUBLISHED");
  });
  it("bloquea orden ocupado y no mueve ninguna sección", async () => {
    estado.hub.sections = [seccion()];
    const r = await aplicar([archivo("otra.md", "titulo: Otra sección\norden: 2")]);
    expect(r.lote[0].bloqueos.join(" ")).toContain("Introducción");
    expect(r.writesPerformed).toBe(false);
    expect(estado.escrituras).toEqual([]);
    expect(estado.hub.sections[0].position).toBe(2);
  });
  it("bloquea dos archivos que solicitan la misma posición", async () => {
    const r = await leer([archivo("una.md", "titulo: Una\norden: 3"), archivo("otra.md", "titulo: Otra\norden: 3")]);
    expect(r.resumen.bloqueados).toBe(2);
  });
  it("actualiza una sección de varias del mismo tipo mediante seccion_id", async () => {
    estado.hub.sections = [seccion({ id: "una" }), seccion({ id: "otra", position: 4 })];
    const ambiguo = await leer([archivo("intro.md", "titulo: Editada\ntipo_seccion: EDITORIAL_INTRO")]);
    expect(ambiguo.lote[0].bloqueos.join(" ")).toContain("varias secciones");
    const seleccionado = await leer([archivo("intro.md", "titulo: Editada\nseccion_id: otra")]);
    // La vista pública admite un único módulo por tipo especializado.
    expect(seleccionado.lote[0].moduloId).toBe("otra");
  });
  it("rechaza destinos de otro hub y _hub dirigido a una sección", async () => {
    estado.hub.sections = [seccion()];
    expect((await leer([archivo("intro.md", "titulo: Editada\nseccion_id: ajena")])).resumen.bloqueados).toBe(1);
    expect((await leer([archivo("_hub.md", "titulo: Portada", "")], { destino: "existente" })).resumen.bloqueados).toBe(1);
  });
  it("no confirma una vista previa desactualizada", async () => {
    const archivos = [archivo("una.md", "titulo: Una")];
    const previo = await leer(archivos);
    estado.hub.title = "Cambio concurrente";
    const r = await aplicarLoteContenido({ hubId: "hub", archivos, feed: true, revision: previo.revision });
    expect(r.motivo).toBe("revision");
    expect(estado.escrituras).toEqual([]);
  });
  it("comprueba rutas y acepta los enlaces a secciones de su propia página", async () => {
    const correcto = await leer([archivo("una.md", "titulo: Una", "[Otra](/ansiedad#otra)")]);
    expect(correcto.resumen.bloqueados).toBe(0);
    const roto = await leer([archivo("una.md", "titulo: Una", "[Artículo](/blog/no-existe)")]);
    expect(roto.lote[0].bloqueos.join(" ")).toContain("/blog/no-existe");
  });
  it("permite cargar psicoanalista.md con enlaces publicados hacia otro hub", async () => {
    const modulos = ["tratamiento-breve-15-sesiones", "terapia-para-la-ansiedad", "ataque-de-panico", "duelo", "conflictos-de-pareja", "estres-laboral-y-burnout"];
    estado.hub.slug = "psicoanalisis";
    estado.hubsProfesionales = [{ slug: "raul-olmedo-evans", status: "PUBLISHED", isActive: true, modules: modulos.map((slug) => ({ slug, isPublished: true, isVisible: true })) }];
    const cuerpo = modulos.map((slug) => `[Consultar](/raul-olmedo-evans/${slug})`).join("\n\n");
    const r = await leer([archivo("psicoanalista (1).md", "titulo: Psicoanalista en Costa Rica\norden: 9", cuerpo)]);
    expect(r.resumen.bloqueados).toBe(0);
    expect(r.lote[0].ruta).toBe("/psicoanalisis#psicoanalista-1");
    expect(r.lote[0].avisos.join(" ")).toContain("copia descargada");
    expect(r.lote[0].enlaces.every((enlace) => enlace.estado === "ok")).toBe(true);
    expect(r.lote[0].diff.find((cambio) => cambio.campo === "tipo de sección").despues).toBe("Texto enriquecido");
    expect(estado.escrituras).toEqual([]);
  });
  it("agrega artículos publicados y conserva los vínculos previos", async () => {
    estado.hub.posts = [{ postId: "previo", status: "APPROVED", role: "PRIMARY" }];
    estado.articulos = [{ id: "nuevo", slug: "lectura" }];
    const archivos = [archivo("_hub.md", "articulos_relacionados: [lectura]", "")];
    await aplicar(archivos);
    expect(estado.hub.posts).toContainEqual({ postId: "previo", status: "APPROVED", role: "PRIMARY" });
    expect(estado.hub.posts).toContainEqual(expect.objectContaining({ postId: "nuevo", status: "APPROVED" }));
    estado.escrituras = [];
    expect((await aplicar(archivos)).writesPerformed).toBe(false);
    expect(estado.escrituras).toEqual([]);
  });
  it("bloquea una búsqueda repetida con otro hub de contenido", async () => {
    estado.portadas = [{ topicId: "otro", config: { ingesta: { metadatos: { busqueda_objetivo: "ansiedad" } } }, topic: { slug: "otra-ruta", status: "PUBLISHED" } }];
    const r = await leer([archivo("_hub.md", "busqueda_objetivo: ansiedad", "")]);
    expect(r.lote[0].bloqueos.join(" ")).toContain("/otra-ruta");
  });
});

describe("contrato Markdown de contenido", () => {
  it.each(["tipo_seccion: DESCONOCIDO", "orden: 1.5", "no_indexar: texto", "busqueda_objetivo: []"])("bloquea el dato inválido %s", (campo) => {
    expect(parseTopicHubDocument(`---\ntitulo: Sección\n${campo}\n---\n\nTexto.`, "seccion.md").bloqueos.length).toBeGreaterThan(0);
  });
  it("conserva metadatos de una pieza profesional adaptada a una sección", () => {
    const r = parseTopicHubDocument("---\ntitulo: Consulta\ntipo: tema\ntarjeta: Breve\nfecha: 2026-11-13\n---\n\nTexto.", "consulta.md");
    expect(r.bloqueos).toEqual([]);
    expect(r.metadatos).toMatchObject({ tarjeta: "Breve", fecha: "2026-11-13" });
  });
  it("bloquea contenido prohibido y cuerpo de portada", () => {
    expect(parseTopicHubDocument("---\ntitulo: Ejemplo\n---\n\nPsicólogos en Costa Rica", "seccion.md").bloqueos.join(" ")).toContain("frase plural");
    expect(parseTopicHubDocument("---\ntipo: hub\n---\n\nCuerpo.", "_hub.md").bloqueos.join(" ")).toContain("frontmatter");
    expect(parseTopicHubDocument("---\ntitulo: Texto\n---\n\n{{precio_sesion}}", "seccion.md").bloqueos.join(" ")).toContain("hub profesional");
  });
});

it("el render de contenido muestra todas las secciones importadas visibles y omite la fila técnica", () => {
  const sections = [
    seccion({ id: "tecnica", type: "CUSTOM_RICH_TEXT", body: "Interno", isVisible: false, config: { ingesta: { slug: "_hub" } } }),
    seccion({ id: "historica", type: "CUSTOM_RICH_TEXT" }),
    seccion({ id: "duplicada-anterior", type: "CUSTOM_RICH_TEXT" }),
    seccion({ id: "importada", type: "CUSTOM_RICH_TEXT", config: { ingesta: { slug: "lectura" } } }),
    seccion({ id: "oculta", type: "CUSTOM_RICH_TEXT", isVisible: false, config: { ingesta: { slug: "oculta" } } }),
    seccion({ id: "vacia", type: "CUSTOM_RICH_TEXT", body: "", config: { ingesta: { slug: "vacia" } } }),
  ];
  expect(topicCustomSections(sections).map((s) => s.id)).toEqual(["historica", "importada"]);
});
