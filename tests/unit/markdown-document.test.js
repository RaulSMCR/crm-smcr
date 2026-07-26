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
    expect(result.warnings).toHaveLength(0);
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
