import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * La ingesta con la base mockeada.
 *
 * Lo que se prueba acá son las reglas que no están en el parser y que son las
 * que duelen si se rompen: que una importación no publique, que no borre el
 * cuerpo ni la metadata de una fila, que el orden no pise a otro módulo y que
 * dos piezas no salgan a competir por la misma búsqueda.
 */

const base = vi.hoisted(() => ({
  hub: null,
  modulos: [],
  hubs: [],
  posts: [],
  servicios: [],
  temas: [],
  escrituras: [],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    professionalHub: {
      findUnique: vi.fn(async () => base.hub),
      findMany: vi.fn(async () => base.hubs),
      update: vi.fn(async (args) => {
        base.escrituras.push({ tabla: "hub", op: "update", ...args });
        return {};
      }),
    },
    professionalHubModule: {
      findMany: vi.fn(async () => base.modulos),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async (args) => {
        base.escrituras.push({ tabla: "modulo", op: "update", ...args });
        return {};
      }),
      create: vi.fn(async (args) => {
        base.escrituras.push({ tabla: "modulo", op: "create", ...args });
        return {};
      }),
    },
    post: { findMany: vi.fn(async () => base.posts) },
    service: { findMany: vi.fn(async () => base.servicios) },
    topic: { findMany: vi.fn(async () => base.temas) },
    $transaction: vi.fn(async (fn) => {
      const tx = {
        professionalHub: {
          update: async (args) => {
            base.escrituras.push({ tabla: "hub", op: "update", ...args });
            return {};
          },
        },
        professionalHubModule: {
          findFirst: async () => null,
          update: async (args) => {
            base.escrituras.push({ tabla: "modulo", op: "update", ...args });
            return {};
          },
          create: async (args) => {
            base.escrituras.push({ tabla: "modulo", op: "create", ...args });
            return {};
          },
        },
      };
      return fn(tx);
    }),
  },
}));

const { leerLote, aplicarLote } = await import("@/lib/hub-ingest");

const HUB_ID = "hub-1";

function hubFalso(extra = {}) {
  return {
    id: HUB_ID,
    slug: "raul-olmedo-evans",
    name: "Raúl Olmedo Evans",
    title: "Psicoanálisis para lo que te pasa hoy",
    description: "",
    whatsapp: "50671291909",
    modality: "en línea",
    durationMin: 50,
    featuredSeriesSlug: "la-angustia-y-sus-formas",
    heroVideoUrl: "",
    heroPosterUrl: "",
    logoUrl: "",
    enabledFunctions: ["agenda", "whatsapp", "topics"],
    status: "PUBLISHED",
    metaTitle: null,
    metaDescription: null,
    ogImage: null,
    focusKeyword: null,
    noindex: false,
    modules: [],
    ...extra,
  };
}

function moduloFalso(extra = {}) {
  return {
    id: "mod-1",
    hubId: HUB_ID,
    slug: "duelo",
    type: "TOPIC",
    title: "Duelo",
    summary: "Acompañar una pérdida.",
    body: "## Una pérdida cambia más de una cosa\n\nTexto viejo.",
    metadata: { fecha: "2026-09-10", actualizado: "2026-09-10" },
    position: 1,
    isVisible: true,
    isPublished: true,
    metaTitle: null,
    metaDescription: null,
    focusKeyword: null,
    ogImage: null,
    noindex: false,
    ...extra,
  };
}

function documento({ slug = "duelo", titulo = "Duelo", publicado = true, orden = null, busqueda = "", cuerpo = "## Sección\n\nProsa nueva.", extra = "" } = {}) {
  const frontmatter = [
    "---",
    `titulo: "${titulo}"`,
    'titulo_seo: "Psicoterapia para atravesar un duelo en línea"',
    'meta: "Un espacio para elaborar una pérdida, escuchar sus efectos y encontrar una forma propia de continuar hoy."',
    'resumen: "Acompañar una pérdida sin reducirla a un calendario."',
    'tarjeta: "Cuando una pérdida cambia más de una cosa"',
    orden === null ? null : `orden: ${orden}`,
    "fecha: 2026-09-10",
    "actualizado: 2026-09-12",
    busqueda ? `busqueda_objetivo: "${busqueda}"` : null,
    `publicado: ${publicado}`,
    extra || null,
    "---",
    "",
    cuerpo,
  ].filter((linea) => linea !== null);
  return { nombre: `${slug}.md`, texto: frontmatter.join("\n") };
}

beforeEach(() => {
  base.hub = hubFalso();
  base.modulos = [];
  base.hubs = [];
  base.posts = [];
  base.servicios = [];
  base.temas = [];
  base.escrituras = [];
});

describe("leerLote · no escribe", () => {
  it("un tema nuevo entra como borrador aunque el archivo diga publicado: true", async () => {
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento({ slug: "ansiedad-y-cuerpo", publicado: true })] });
    const fila = informe.lote[0];
    expect(fila.accion).toBe("crear");
    expect(fila.payload.isPublished).toBe(false);
    expect(fila.avisos.some((aviso) => aviso.includes("no publica"))).toBe(true);
    expect(base.escrituras).toEqual([]);
  });

  it("publicado: false despublica un módulo que estaba publicado", async () => {
    base.hub = hubFalso({ modules: [moduloFalso()] });
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento({ publicado: false })] });
    const fila = informe.lote[0];
    expect(fila.accion).toBe("actualizar");
    expect(fila.payload.isPublished).toBe(false);
    expect(fila.avisos.some((aviso) => aviso.includes("despublica"))).toBe(true);
  });

  it("un módulo publicado que se actualiza sigue publicado", async () => {
    base.hub = hubFalso({ modules: [moduloFalso()] });
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento({ publicado: true })] });
    expect(informe.lote[0].payload.isPublished).toBe(true);
  });

  it("fusiona metadata en vez de reemplazarla", async () => {
    base.hub = hubFalso({
      modules: [moduloFalso({ metadata: { fecha: "2026-09-10", actualizado: "2026-09-10", tarjeta: "vieja", notas_internas: "no tocar" } })],
    });
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento()] });
    const metadata = informe.lote[0].payload.metadata;
    expect(metadata.notas_internas).toBe("no tocar");
    expect(metadata.tarjeta).toBe("Cuando una pérdida cambia más de una cosa");
    expect(metadata.actualizado).toBe("2026-09-12");
  });

  it("un archivo sin cuerpo conserva el cuerpo de la fila y no lo muestra como cambio", async () => {
    base.hub = hubFalso({ modules: [moduloFalso()] });
    const sinCuerpo = documento({ cuerpo: "" });
    const informe = await leerLote({ hubId: HUB_ID, archivos: [sinCuerpo] });
    const fila = informe.lote[0];
    expect(fila.escribible).toBe(true);
    expect(fila.payload.body).toBeUndefined();
    expect(fila.diff.some((cambio) => cambio.campo === "cuerpo")).toBe(false);
    expect(fila.avisos.some((aviso) => aviso.includes("se conserva el cuerpo"))).toBe(true);
  });

  it("un archivo sin cuerpo y sin módulo previo se bloquea", async () => {
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento({ slug: "tema-nuevo", cuerpo: "" })] });
    expect(informe.lote[0].escribible).toBe(false);
    expect(informe.lote[0].bloqueos.some((error) => error.includes("no existe"))).toBe(true);
  });

  it("el orden que ya tiene otro módulo se reasigna y se dice a cuál", async () => {
    base.hub = hubFalso({ modules: [moduloFalso({ slug: "ataque-de-panico", position: 2 })] });
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento({ slug: "duelo", orden: 2 })] });
    const fila = informe.lote[0];
    expect(fila.payload.position).not.toBe(2);
    expect(fila.avisos.some((aviso) => aviso.includes("ataque-de-panico"))).toBe(true);
  });

  it("dos archivos con la misma búsqueda objetivo se bloquean los dos", async () => {
    const informe = await leerLote({
      hubId: HUB_ID,
      archivos: [
        documento({ slug: "duelo", busqueda: "psicoterapia para duelo" }),
        documento({ slug: "perdidas", busqueda: "Psicoterapia para Duelo" }),
      ],
    });
    expect(informe.lote[0].escribible).toBe(false);
    expect(informe.lote[1].escribible).toBe(false);
    expect(informe.resumen.bloqueados).toBe(2);
  });

  it("bloquea si un artículo publicado ya persigue esa búsqueda", async () => {
    base.posts = [{ slug: "la-angustia-y-sus-formas", focusKeyword: "psicoterapia para duelo" }];
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento({ busqueda: "psicoterapia para duelo" })] });
    expect(informe.lote[0].bloqueos.some((error) => error.includes("/blog/la-angustia-y-sus-formas"))).toBe(true);
  });

  it("bloquea si otro módulo del mismo hub ya persigue esa búsqueda", async () => {
    base.hub = hubFalso({ modules: [moduloFalso({ slug: "perdidas", focusKeyword: "psicoterapia para duelo" })] });
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento({ busqueda: "psicoterapia para duelo" })] });
    expect(informe.lote[0].bloqueos.some((error) => error.includes("/raul-olmedo-evans/perdidas"))).toBe(true);
  });

  it("el mismo módulo puede conservar su propia búsqueda al actualizarse", async () => {
    base.hub = hubFalso({ modules: [moduloFalso({ focusKeyword: "psicoterapia para duelo" })] });
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento({ busqueda: "psicoterapia para duelo" })] });
    expect(informe.lote[0].bloqueos).toEqual([]);
  });

  it("el mismo archivo dos veces en el lote se bloquea", async () => {
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento(), documento()] });
    expect(informe.lote.every((fila) => !fila.escribible)).toBe(true);
  });

  it("avisa cuando el cuerpo enlaza una ruta que no existe publicada", async () => {
    const informe = await leerLote({
      hubId: HUB_ID,
      archivos: [documento({ cuerpo: "## Sección\n\nVer [el artículo](/blog/no-existe)." })],
    });
    expect(informe.lote[0].avisos.some((aviso) => aviso.includes("/blog/no-existe"))).toBe(true);
  });

  it("no avisa de /ayuda-inmediata, que es una ruta del sitio", async () => {
    const informe = await leerLote({
      hubId: HUB_ID,
      archivos: [documento({ cuerpo: "## Sección\n\nVer [ayuda inmediata](/ayuda-inmediata)." })],
    });
    expect(informe.lote[0].avisos.some((aviso) => aviso.includes("ayuda-inmediata"))).toBe(false);
  });

  it("un hub sin página propia se marca como ruta inexistente", async () => {
    base.hub = hubFalso({ slug: "otra-persona" });
    const informe = await leerLote({ hubId: HUB_ID, archivos: [documento({ slug: "tema-nuevo" })] });
    expect(informe.hub.rutaExiste).toBe(false);
  });

  it("_hub.md compara columnas y separa el copy sin columna", async () => {
    const hubMd = {
      nombre: "_hub.md",
      texto: [
        "---",
        "tipo: hub",
        "titulo: Otro título para el hub",
        "duracion_min: 45",
        "hero:",
        "  deck: Una conversación con quien escucha",
        "---",
        "",
        "Notas de redacción.",
      ].join("\n"),
    };
    const informe = await leerLote({ hubId: HUB_ID, archivos: [hubMd] });
    const fila = informe.lote[0];
    expect(fila.clase).toBe("hub");
    expect(fila.diff.some((cambio) => cambio.campo === "título")).toBe(true);
    expect(fila.diff.some((cambio) => cambio.campo === "duración (min)")).toBe(true);
    expect(fila.payload.copy.hero.deck).toBe("Una conversación con quien escucha");
  });

  it("rechaza un hub que no existe", async () => {
    base.hub = null;
    const informe = await leerLote({ hubId: "no-existe", archivos: [documento()] });
    expect(informe.error).toBeTruthy();
  });
});

describe("aplicarLote · escribe", () => {
  it("crea el módulo en borrador y sella la importación", async () => {
    const resultado = await aplicarLote({ hubId: HUB_ID, archivos: [documento({ slug: "ansiedad-y-cuerpo" })], actor: "raul@smcr.cr" });
    expect(resultado.writesPerformed).toBe(true);
    const escritura = base.escrituras.find((item) => item.tabla === "modulo" && item.op === "create");
    expect(escritura.data.slug).toBe("ansiedad-y-cuerpo");
    expect(escritura.data.hubId).toBe(HUB_ID);
    expect(escritura.data.isPublished).toBe(false);
    expect(escritura.data.metadata.importacion.archivo).toBe("ansiedad-y-cuerpo.md");
    expect(escritura.data.metadata.importacion.actor).toBe("raul@smcr.cr");
    expect(escritura.data.metadata.importacion.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("actualiza el módulo existente por id, sin crear otro", async () => {
    base.hub = hubFalso({ modules: [moduloFalso()] });
    await aplicarLote({ hubId: HUB_ID, archivos: [documento()] });
    const creaciones = base.escrituras.filter((item) => item.op === "create");
    const updates = base.escrituras.filter((item) => item.tabla === "modulo" && item.op === "update");
    expect(creaciones).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(updates[0].where.id).toBe("mod-1");
  });

  it("un lote enteramente bloqueado no escribe nada", async () => {
    const resultado = await aplicarLote({ hubId: HUB_ID, archivos: [documento({ slug: "tema-nuevo", cuerpo: "" })] });
    expect(resultado.writesPerformed).toBe(false);
    expect(base.escrituras).toEqual([]);
  });

  it("_hub.md actualiza columnas del hub y guarda el copy en un módulo invisible", async () => {
    const hubMd = {
      nombre: "_hub.md",
      texto: ["---", "tipo: hub", "titulo: Otro título", "cierre:", "  invitacion: Agendar", "---", "", "Notas."].join("\n"),
    };
    await aplicarLote({ hubId: HUB_ID, archivos: [hubMd] });
    const hubUpdate = base.escrituras.find((item) => item.tabla === "hub");
    const copy = base.escrituras.find((item) => item.tabla === "modulo");
    expect(hubUpdate.data.title).toBe("Otro título");
    expect(copy.data.slug).toBe("_hub");
    expect(copy.data.isVisible).toBe(false);
    expect(copy.data.isPublished).toBe(false);
    expect(copy.data.metadata.copy.cierre.invitacion).toBe("Agendar");
  });
});
