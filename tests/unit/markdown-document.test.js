import { describe, expect, it } from "vitest";
import { isMarkdownFileName, parseMarkdownDocument } from "@/lib/markdown-document";

describe("parseMarkdownDocument", () => {
  it("toma el título del primer H1 y lo saca del cuerpo", () => {
    const result = parseMarkdownDocument("# Duelo y trabajo\n\nPrimer párrafo.\n");
    expect(result.title).toBe("Duelo y trabajo");
    expect(result.content).toBe("Primer párrafo.");
  });

  it("lee front matter YAML y respeta su título sobre el H1", () => {
    const file = [
      "---",
      "title: Ansiedad en la consulta",
      "slug: ansiedad-consulta",
      'meta_description: "Guía breve para pacientes."',
      "palabra clave: ansiedad",
      "---",
      "",
      "# Otro título",
      "",
      "Cuerpo del artículo.",
    ].join("\n");

    const result = parseMarkdownDocument(file);
    expect(result.title).toBe("Ansiedad en la consulta");
    expect(result.slug).toBe("ansiedad-consulta");
    expect(result.metaDescription).toBe("Guía breve para pacientes.");
    expect(result.focusKeyword).toBe("ansiedad");
    expect(result.content).toBe("Cuerpo del artículo.");
  });

  it("extrae el bloque de metadatos CRM y no lo deja en el contenido", () => {
    const file = [
      "# Sueño y adolescencia",
      "",
      "Contenido publicable.",
      "",
      "## Metadatos para CRM",
      "**Slug:** sueno-adolescencia",
      "**Meta title:** Sueño y adolescencia",
      "**Focus keyword:** sueño adolescente",
    ].join("\n");

    const result = parseMarkdownDocument(file);
    expect(result.content).toBe("Contenido publicable.");
    expect(result.slug).toBe("sueno-adolescencia");
    expect(result.metaTitle).toBe("Sueño y adolescencia");
    expect(result.crmMetadata).toMatchObject({ focusKeyword: "sueño adolescente" });
  });

  it("cae al nombre del archivo cuando no hay título en ninguna parte", () => {
    const result = parseMarkdownDocument("Solo cuerpo, sin encabezado.", "C:/docs/duelo_perinatal.md");
    expect(result.title).toBe("Duelo perinatal");
    expect(result.content).toBe("Solo cuerpo, sin encabezado.");
    // Un archivo sin metadatos no es un error, pero sí algo que hay que decir:
    // si no se avisa acá, la falta aparece semanas después como deuda editorial.
    expect(result.warnings).toEqual([
      expect.stringContaining("no trae bloque de metadatos"),
    ]);
  });

  it("avisa cuando el archivo viene sin cuerpo", () => {
    const result = parseMarkdownDocument("# Solo título\n", "nota.md");
    expect(result.content).toBe("");
    expect(result.warnings.join(" ")).toMatch(/no tiene contenido/i);
  });

  it("normaliza CRLF y BOM", () => {
    const result = parseMarkdownDocument("\ufeff---\r\ntitle: Con BOM\r\n---\r\n\r\nTexto.\r\n");
    expect(result.title).toBe("Con BOM");
    expect(result.content).toBe("Texto.");
  });

  it("ignora claves de front matter que no mapean a campos del CRM", () => {
    const result = parseMarkdownDocument("---\ntitle: Uno\nauthor: Alguien\ntags: [a, b]\n---\n\nTexto.");
    expect(result.title).toBe("Uno");
    expect(result.slug).toBeNull();
    expect(result.content).toBe("Texto.");
  });

  it("carga SEO completo y metadatos de serie desde front matter", () => {
    const file = [
      "---",
      "title: Artículo de la serie",
      "excerpt: Resumen para la biblioteca",
      "meta_title: Título SEO",
      "meta_description: Descripción SEO",
      "focus_keyword: salud mental",
      "og_image: https://example.com/social.png",
      "noindex: true",
      "series: Qué llamamos salud",
      "part: 3",
      "---",
      "",
      "Texto principal del artículo.",
    ].join("\n");

    expect(parseMarkdownDocument(file)).toMatchObject({
      title: "Artículo de la serie",
      excerpt: "Resumen para la biblioteca",
      metaTitle: "Título SEO",
      metaDescription: "Descripción SEO",
      focusKeyword: "salud mental",
      ogImage: "https://example.com/social.png",
      noindex: true,
      seriesName: "Qué llamamos salud",
      seriesOrder: 3,
    });
  });
});

describe("isMarkdownFileName", () => {
  it("acepta extensiones de texto y rechaza el resto", () => {
    expect(isMarkdownFileName("articulo.md")).toBe(true);
    expect(isMarkdownFileName("ARTICULO.MARKDOWN")).toBe(true);
    expect(isMarkdownFileName("notas.txt")).toBe(true);
    expect(isMarkdownFileName("portada.png")).toBe(false);
    expect(isMarkdownFileName("")).toBe(false);
  });
});

describe("parseMarkdownDocument — completitud editorial", () => {
  const completo = [
    "# Angustia y angosto vienen de la misma raíz",
    "",
    "Cuerpo del artículo.",
    "",
    "## Metadatos",
    "Slug: angustia-y-angosto-misma-raiz",
    "Deck: Primera entrega de una serie sobre la angustia.",
    "Título alternativo SEO: Angustia y ansiedad, de dónde vienen",
    "Meta description: Angustia y angosto son la misma palabra latina.",
    "Palabra clave: origen de la palabra angustia",
    "Bloque extractivo: Angustia viene del latín angustus, estrecho.",
    "Alt de portada: Un desfiladero estrecho entre paredes de roca.",
    "Fase: Fase 5",
    "Serie: La angustia y sus formas",
    "Parte: 1",
    "Disciplinas: Psicología clínica",
    "Temas: angustia, lenguaje",
  ].join("\n");

  it("saca todo lo que el artículo necesita y no reporta faltantes", () => {
    const result = parseMarkdownDocument(completo, "01-angustia.md");
    expect(result.title).toBe("Angustia y angosto vienen de la misma raíz");
    expect(result.content).toBe("Cuerpo del artículo.");
    expect(result.slug).toBe("angustia-y-angosto-misma-raiz");
    expect(result.metaTitle).toBe("Angustia y ansiedad, de dónde vienen");
    expect(result.extractiveBlock).toBe("Angustia viene del latín angustus, estrecho.");
    expect(result.coverImageAlt).toBe("Un desfiladero estrecho entre paredes de roca.");
    expect(result.seriesName).toBe("La angustia y sus formas");
    expect(result.seriesOrder).toBe(1);
    expect(result.disciplines).toEqual(["Psicología clínica"]);
    expect(result.topics).toEqual(["angustia", "lenguaje"]);
    expect(result.faltantes).toEqual([]);
  });

  it("nombra lo que falta en vez de rellenarlo con el cuerpo del artículo", () => {
    // Un resumen automático que nadie leyó termina publicado como si lo hubiera
    // escrito alguien: el campo se deja vacío y se dice.
    const result = parseMarkdownDocument(
      ["# Título", "", "Cuerpo.", "", "## Metadatos", "Deck: Un resumen."].join("\n"),
      "art.md",
    );
    expect(result.excerpt).toBe("Un resumen.");
    expect(result.metaDescription).toBeNull();
    expect(result.faltantes).toContain("meta description");
    expect(result.faltantes).toContain("bloque extractivo");
    expect(result.faltantes).toContain("temas");
    expect(result.faltantes).not.toContain("resumen (deck)");
  });

  it("lee la taxonomía del front matter, con o sin corchetes", () => {
    const result = parseMarkdownDocument(
      ["---", "title: Nota", "temas: [angustia, sueño]", "disciplinas: Psicología clínica", "---", "", "Cuerpo."].join("\n"),
      "nota.md",
    );
    expect(result.topics).toEqual(["angustia", "sueño"]);
    expect(result.disciplines).toEqual(["Psicología clínica"]);
  });
});
