import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  BLOQUES_ESPERADOS,
  leerBloques,
  leerEncabezados,
  leerEnlacesInternos,
  parseEscalarYaml,
  parseFrontmatter,
  parseHubDocument,
  partirDocumento,
  slugDeArchivo,
} from "@/lib/hub-markdown";

const DIRECTORIO = join(process.cwd(), "content", "hub-raul");

function leerArchivo(nombre) {
  return readFileSync(join(DIRECTORIO, nombre), "utf8");
}

const TEMA_MINIMO = `---
titulo: "Ataque de pánico"
titulo_seo: "Consulta psicológica para ataques de pánico en línea"
meta: "Un espacio para entender qué ocurre en el cuerpo durante una crisis de angustia y empezar a trabajarlo en consulta."
resumen: "Entender lo que ocurre en el cuerpo y abrir un espacio para trabajarlo."
tarjeta: "Cuando el cuerpo se adelanta a las palabras"
orden: 3
fecha: 2026-09-10
actualizado: 2026-09-12
herramienta_relacionada: ""
articulos_relacionados: []
busqueda_objetivo: "ataque de pánico tratamiento en línea"
publicado: true
---

## Qué ocurre en una crisis

Prosa.

<!-- bloque: cuando-consultar -->
## Cuándo conviene consultar

- Cuando se repite.

<!-- bloque: riesgo -->
## Si estás en una situación de riesgo

Texto con enlace a [Ayuda inmediata](/ayuda-inmediata).
`;

describe("parseEscalarYaml", () => {
  it("quita las comillas y conserva el contenido", () => {
    expect(parseEscalarYaml('"Duelo: una pérdida"')).toBe("Duelo: una pérdida");
    expect(parseEscalarYaml("'sin tildes'")).toBe("sin tildes");
  });

  it("lee booleanos, enteros y listas en una línea", () => {
    expect(parseEscalarYaml("true")).toBe(true);
    expect(parseEscalarYaml("false")).toBe(false);
    expect(parseEscalarYaml("6")).toBe(6);
    expect(parseEscalarYaml("[]")).toEqual([]);
    expect(parseEscalarYaml('["duelo", "perdida"]')).toEqual(["duelo", "perdida"]);
  });

  it("deja la fecha ISO como texto y no la convierte en número", () => {
    expect(parseEscalarYaml("2026-09-12")).toBe("2026-09-12");
  });
});

describe("parseFrontmatter", () => {
  it("lee pares planos", () => {
    const fm = parseFrontmatter('titulo: Duelo\nresumen: "Una pérdida"\norden: 2');
    expect(fm).toEqual({ titulo: "Duelo", resumen: "Una pérdida", orden: 2 });
  });

  it("lee secciones anidadas, que es lo que necesita _hub.md", () => {
    const fm = parseFrontmatter([
      "tipo: hub",
      "hero:",
      "  titulo: Psicoanálisis para lo que te pasa hoy",
      "  deck: Una conversación con quien escucha",
      "cierre:",
      "  invitacion: Agendar una primera sesión",
    ].join("\n"));
    expect(fm.tipo).toBe("hub");
    expect(fm.hero).toEqual({ titulo: "Psicoanálisis para lo que te pasa hoy", deck: "Una conversación con quien escucha" });
    expect(fm.cierre.invitacion).toBe("Agendar una primera sesión");
  });

  it("lee listas con guión", () => {
    const fm = parseFrontmatter("herramientas_habilitadas:\n  - agenda\n  - whatsapp\n");
    expect(fm.herramientas_habilitadas).toEqual(["agenda", "whatsapp"]);
  });

  it("lee bloques de texto con | y con >", () => {
    const fm = parseFrontmatter("nota: |\n  Primera línea\n  Segunda línea\nresumen: >\n  Una sola\n  frase\n");
    expect(fm.nota).toBe("Primera línea\nSegunda línea");
    expect(fm.resumen).toBe("Una sola frase");
  });
});

describe("partirDocumento", () => {
  it("separa frontmatter de cuerpo y normaliza CRLF y BOM", () => {
    const { frontmatter, body, tieneFrontmatter } = partirDocumento("﻿---\r\ntitulo: X\r\n---\r\n\r\n## Hola\r\n");
    expect(tieneFrontmatter).toBe(true);
    expect(frontmatter).toBe("titulo: X");
    expect(body).toBe("## Hola");
  });

  it("sin --- no hay frontmatter y el cuerpo queda completo", () => {
    const { tieneFrontmatter, body } = partirDocumento("## Solo cuerpo");
    expect(tieneFrontmatter).toBe(false);
    expect(body).toBe("## Solo cuerpo");
  });
});

describe("lectura del cuerpo", () => {
  it("extrae los ## y ### con su ancla", () => {
    const encabezados = leerEncabezados("## Una pérdida cambia más de una cosa\n\ntexto\n\n### Qué hacer");
    expect(encabezados).toEqual([
      { nivel: 2, texto: "Una pérdida cambia más de una cosa", id: "una-perdida-cambia-mas-de-una-cosa" },
      { nivel: 3, texto: "Qué hacer", id: "que-hacer" },
    ]);
  });

  it("lee los marcadores de bloque en orden y sin repetir", () => {
    expect(leerBloques("<!-- bloque: cuando-consultar -->\n## A\n<!-- bloque: riesgo -->\n## B")).toEqual([
      "cuando-consultar",
      "riesgo",
    ]);
  });

  it("lee solo los enlaces internos", () => {
    const enlaces = leerEnlacesInternos("[a](/ayuda-inmediata) [b](https://otro.com/x) [c](/blog/duelo)");
    expect(enlaces).toEqual(["/ayuda-inmediata", "/blog/duelo"]);
  });
});

describe("parseHubDocument · tema", () => {
  it("mapea el frontmatter a las columnas del módulo", () => {
    const doc = parseHubDocument(TEMA_MINIMO, "ataque-de-panico.md");
    expect(doc.clase).toBe("tema");
    expect(doc.slug).toBe("ataque-de-panico");
    expect(doc.bloqueos).toEqual([]);
    expect(doc.modulo.title).toBe("Ataque de pánico");
    expect(doc.modulo.type).toBe("TOPIC");
    expect(doc.modulo.position).toBe(3);
    expect(doc.modulo.metaTitle).toBe("Consulta psicológica para ataques de pánico en línea");
    expect(doc.modulo.focusKeyword).toBe("ataque de pánico tratamiento en línea");
    expect(doc.modulo.metadata.tarjeta).toBe("Cuando el cuerpo se adelanta a las palabras");
    expect(doc.modulo.metadata.bloques).toEqual(BLOQUES_ESPERADOS);
    expect(doc.publicado).toBe(true);
    expect(doc.enlaces).toEqual(["/ayuda-inmediata"]);
  });

  it("el slug sale del nombre del archivo, no del frontmatter", () => {
    const doc = parseHubDocument(TEMA_MINIMO.replace("titulo:", "slug: otra-cosa\ntitulo:"), "duelo.md");
    expect(doc.slug).toBe("duelo");
  });

  it("normaliza el nombre del archivo y avisa cuál va a usar", () => {
    const doc = parseHubDocument(TEMA_MINIMO, "Migración y Desarraigo.md");
    expect(doc.slug).toBe("migracion-y-desarraigo");
    expect(doc.avisos.some((aviso) => aviso.includes("migracion-y-desarraigo"))).toBe(true);
  });

  it("el tratamiento breve se reconoce como módulo de tratamiento", () => {
    const doc = parseHubDocument(TEMA_MINIMO, "tratamiento-breve-15-sesiones.md");
    expect(doc.modulo.type).toBe("TREATMENT");
  });

  it("bloquea un # en el cuerpo, porque el h1 sale del título", () => {
    const doc = parseHubDocument(TEMA_MINIMO.replace("## Qué ocurre", "# Qué ocurre"), "duelo.md");
    expect(doc.bloqueos.some((error) => error.includes("«#»"))).toBe(true);
  });

  it("bloquea precios y teléfonos literales", () => {
    const conPrecio = TEMA_MINIMO.replace("Prosa.", "La sesión cuesta ₡40.000.");
    expect(parseHubDocument(conPrecio, "duelo.md").bloqueos.some((e) => e.includes("precio"))).toBe(true);
    const conTelefono = TEMA_MINIMO.replace("Prosa.", "Escribime al +506 7129 1909.");
    expect(parseHubDocument(conTelefono, "duelo.md").bloqueos.some((e) => e.includes("precio"))).toBe(true);
  });

  it("bloquea enlaces absolutos al propio dominio", () => {
    const doc = parseHubDocument(TEMA_MINIMO.replace("/ayuda-inmediata", "https://saludmentalcostarica.com/ayuda-inmediata"), "duelo.md");
    expect(doc.bloqueos.some((error) => error.includes("absoluto"))).toBe(true);
  });

  it("bloquea HTML ejecutable", () => {
    const doc = parseHubDocument(TEMA_MINIMO.replace("Prosa.", '<script>alert(1)</script>'), "duelo.md");
    expect(doc.bloqueos.some((error) => error.includes("HTML"))).toBe(true);
  });

  it("bloquea un slug reservado por una ruta del sitio", () => {
    const doc = parseHubDocument(TEMA_MINIMO, "blog.md");
    expect(doc.bloqueos.some((error) => error.includes("reservado"))).toBe(true);
  });

  it("avisa de los bloques que faltan, sin bloquear", () => {
    const doc = parseHubDocument(TEMA_MINIMO.replace("<!-- bloque: riesgo -->\n", ""), "duelo.md");
    expect(doc.bloqueos).toEqual([]);
    expect(doc.avisos.some((aviso) => aviso.includes("«riesgo»"))).toBe(true);
  });

  it("avisa de longitudes SEO fuera de rango pero no bloquea", () => {
    const doc = parseHubDocument(TEMA_MINIMO.replace(/titulo_seo: ".*"/, 'titulo_seo: "Corto"'), "duelo.md");
    expect(doc.bloqueos).toEqual([]);
    expect(doc.avisos.some((aviso) => aviso.includes("título SEO"))).toBe(true);
  });

  it("distingue despublicar de no publicar", () => {
    const sinPublicar = parseHubDocument(TEMA_MINIMO.replace("publicado: true", "publicado: false"), "duelo.md");
    expect(sinPublicar.despublicar).toBe(true);
    expect(sinPublicar.publicado).toBe(false);
  });
});

describe("parseHubDocument · _hub.md", () => {
  const HUB = [
    "---",
    "tipo: hub",
    "nombre: Raúl Olmedo Evans",
    "titulo: Psicoanálisis para lo que te pasa hoy",
    "duracion_min: 50",
    "modalidad: en línea",
    "whatsapp: 50671291909",
    "slug: otro-slug",
    "status: PUBLISHED",
    "herramientas_habilitadas:",
    "  - agenda",
    "  - whatsapp",
    "hero:",
    "  deck: Una conversación con quien escucha",
    "---",
    "",
    "Notas de redacción que no se renderizan.",
  ].join("\n");

  it("manda las columnas conocidas al hub", () => {
    const doc = parseHubDocument(HUB, "_hub.md");
    expect(doc.clase).toBe("hub");
    expect(doc.hub.name).toBe("Raúl Olmedo Evans");
    expect(doc.hub.durationMin).toBe(50);
    expect(doc.hub.modality).toBe("en línea");
    expect(doc.hub.whatsapp).toBe("50671291909");
    expect(doc.hub.enabledFunctions).toEqual(["agenda", "whatsapp"]);
  });

  it("ignora slug y status, y lo dice", () => {
    const doc = parseHubDocument(HUB, "_hub.md");
    expect(doc.hub.slug).toBeUndefined();
    expect(doc.hub.status).toBeUndefined();
    expect(doc.avisos.some((aviso) => aviso.includes("«slug»"))).toBe(true);
    expect(doc.avisos.some((aviso) => aviso.includes("«status»"))).toBe(true);
  });

  it("guarda como copy lo que no tiene columna", () => {
    const doc = parseHubDocument(HUB, "_hub.md");
    expect(doc.copy.hero).toEqual({ deck: "Una conversación con quien escucha" });
  });
});

/**
 * El corpus real, que es anterior a este contrato y no lo cumple del todo: tres
 * temas son «páginas en preparación» con frontmatter y sin cuerpo, y el
 * tratamiento no trae fechas. Los tests dicen lo que los archivos son, no lo
 * que nos gustaría que fueran: si mañana se llenan, el que falla es el test y se
 * actualiza a mano.
 */
describe("los archivos reales de content/hub-raul", () => {
  const archivos = readdirSync(DIRECTORIO).filter((nombre) => nombre.endsWith(".md"));

  it("hay archivos que leer", () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  for (const nombre of archivos) {
    it(`${nombre} se lee sin bloqueos y produce un módulo`, () => {
      const doc = parseHubDocument(leerArchivo(nombre), nombre);
      expect(doc.bloqueos).toEqual([]);
      expect(doc.slug).toBe(slugDeArchivo(nombre));
      expect(doc.modulo.title.length).toBeGreaterThan(1);
    });
  }

  it("los tres temas en preparación no traen cuerpo, y se avisa", () => {
    const enPreparacion = ["conflictos-de-pareja.md", "estres-laboral-y-burnout.md", "migracion-y-desarraigo.md"];
    for (const nombre of enPreparacion) {
      const doc = parseHubDocument(leerArchivo(nombre), nombre);
      expect(doc.body).toBe("");
      expect(doc.avisos.some((aviso) => aviso.includes("no trae cuerpo"))).toBe(true);
    }
  });

  it("el tratamiento breve trae cuerpo largo y avisa que le falta la fecha", () => {
    const doc = parseHubDocument(leerArchivo("tratamiento-breve-15-sesiones.md"), "tratamiento-breve-15-sesiones.md");
    expect(doc.modulo.type).toBe("TREATMENT");
    expect(doc.modulo.body.length).toBeGreaterThan(1000);
    expect(doc.avisos.some((aviso) => aviso.includes("«fecha»"))).toBe(true);
  });

  it("los temas con cuerpo traen fecha ISO", () => {
    for (const nombre of ["duelo.md", "ataque-de-panico.md"]) {
      const doc = parseHubDocument(leerArchivo(nombre), nombre);
      expect(doc.modulo.body.length).toBeGreaterThan(100);
      expect(doc.modulo.metadata.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
