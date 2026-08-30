import { describe, expect, it } from "vitest";
import { extractCrmMetadata } from "@/lib/editorial-metadata";

describe("extractCrmMetadata", () => {
  it("extrae los campos del bloque editorial y lo quita del contenido", () => {
    const result = extractCrmMetadata(`# Artículo\n\nTexto principal.\n\n## Metadatos para CRM\n\n**Slug:** \`la-salud-no-se-alcanza-se-recompone\`\n\n**Meta title:** La salud no se alcanza: se recompone\n\n**Meta description:** Descripción para buscadores.\n\n**Focus keyword:** salud como proceso dinámico\n\n**Enlaces internos sugeridos:**\n\n* Índice de la Serie 4.\n* Apertura de la Serie 3.\n\n**Fase:** Fase 4 · Ensayos-manifiesto.\n\n**Serie:** Qué llamamos salud.\n\n**Partes:** Dos entregas.`);

    expect(result.found).toBe(true);
    expect(result.content).toBe("# Artículo\n\nTexto principal.");
    expect(result.metadata).toMatchObject({
      slug: "la-salud-no-se-alcanza-se-recompone",
      metaTitle: "La salud no se alcanza: se recompone",
      metaDescription: "Descripción para buscadores.",
      focusKeyword: "salud como proceso dinámico",
      phase: "Fase 4 · Ensayos-manifiesto.",
      series: "Qué llamamos salud.",
      parts: "Dos entregas.",
      partsCount: null,
    });
    expect(result.metadata.internalLinks).toEqual(["Índice de la Serie 4.", "Apertura de la Serie 3."]);
  });

  it("no modifica textos que no contienen el encabezado", () => {
    const text = "Texto sin bloque de metadatos.";
    expect(extractCrmMetadata(text)).toEqual({ found: false, content: text, metadata: null });
  });

  it("acepta aliases SEO y noindex en el bloque CRM", () => {
    const result = extractCrmMetadata([
      "# Artículo",
      "",
      "Texto.",
      "",
      "## Metadatos para CRM",
      "**metatitle:** Título SEO",
      "**metadescription:** Descripción SEO",
      "**focuskeyword:** bienestar",
      "**ogimage:** https://example.com/og.png",
      "**noindex:** true",
    ].join("\n"));

    expect(result.metadata).toMatchObject({
      metaTitle: "Título SEO",
      metaDescription: "Descripción SEO",
      focusKeyword: "bienestar",
      ogImage: "https://example.com/og.png",
      noindex: true,
    });
  });
});

describe("extractCrmMetadata — nombres que de hecho aparecen escritos", () => {
  it('reconoce el bloque titulado solo "## Metadatos"', () => {
    // Es como lo titula el documento editorial real. Con el encabezado exacto
    // "Metadatos para CRM" como única forma aceptada, el bloque entero se
    // ignoraba en silencio y el artículo entraba sin un solo metadato.
    const result = extractCrmMetadata(
      ["# Artículo", "", "Texto.", "", "## Metadatos", "", "Deck: Un resumen."].join("\n"),
    );
    expect(result.found).toBe(true);
    expect(result.metadata.excerpt).toBe("Un resumen.");
    expect(result.content).toBe("# Artículo\n\nTexto.");
  });

  it('lee "Deck" como resumen y "Título alternativo SEO" como meta title', () => {
    const result = extractCrmMetadata(
      [
        "## Metadatos",
        "",
        'Título alternativo SEO: *"Angustia y ansiedad: de dónde vienen"*.',
        'Deck: *"Primera entrega de una serie. Lo que se perdió fue mucho más que precisión."*',
      ].join("\n"),
    );
    // Se le quitan la cursiva, las comillas y el punto que quedó afuera.
    expect(result.metadata.metaTitle).toBe("Angustia y ansiedad: de dónde vienen");
    expect(result.metadata.excerpt).toBe(
      "Primera entrega de una serie. Lo que se perdió fue mucho más que precisión.",
    );
  });

  it("corta el bloque en el siguiente encabezado", () => {
    const result = extractCrmMetadata(
      [
        "## Metadatos",
        "Slug: angustia-y-angosto",
        "",
        "## Verificaciones pendientes antes de publicar",
        "Meta description: esto no es un metadato, es una nota interna",
      ].join("\n"),
    );
    expect(result.metadata.slug).toBe("angustia-y-angosto");
    expect(result.metadata.metaDescription).toBeUndefined();
  });

  it("lee la taxonomía separada por comas y también en viñetas", () => {
    const result = extractCrmMetadata(
      [
        "## Metadatos para CRM",
        "Disciplinas: Psicología clínica, Psiquiatría",
        "Temas:",
        "- angustia",
        "- ansiedad",
        "* lenguaje",
      ].join("\n"),
    );
    expect(result.metadata.disciplines).toEqual(["Psicología clínica", "Psiquiatría"]);
    expect(result.metadata.topics).toEqual(["angustia", "ansiedad", "lenguaje"]);
  });

  it("lee el bloque extractivo y el crédito de la portada", () => {
    const result = extractCrmMetadata(
      [
        "## Metadatos",
        "Bloque extractivo: Angustia y angosto son la misma palabra latina.",
        "Portada: https://example.com/portada.webp",
        "Alt de portada: Un desfiladero estrecho entre dos paredes de roca.",
        "Autor de la obra: Anónimo",
      ].join("\n"),
    );
    expect(result.metadata.extractiveBlock).toBe(
      "Angustia y angosto son la misma palabra latina.",
    );
    expect(result.metadata.coverImage).toBe("https://example.com/portada.webp");
    expect(result.metadata.coverImageAlt).toBe(
      "Un desfiladero estrecho entre dos paredes de roca.",
    );
    expect(result.metadata.coverImageAuthor).toBe("Anónimo");
  });

  it("no separa por comas los enlaces internos, que llevan comas propias", () => {
    const result = extractCrmMetadata(
      ["## Metadatos", "Enlaces internos sugeridos:", "- Índice de la Serie 4, parte 2."].join("\n"),
    );
    expect(result.metadata.internalLinks).toEqual(["Índice de la Serie 4, parte 2."]);
  });
});

describe("extractCrmMetadata — más de un bloque", () => {
  const documento = [
    "# Artículo",
    "",
    "Cuerpo.",
    "",
    "## Metadatos",
    "Título alternativo SEO: El título viejo",
    "Deck: El resumen que ya estaba.",
    "",
    "## Verificaciones pendientes antes de publicar",
    "- Paginación por verificar.",
    "",
    "## Metadatos para CRM",
    "Meta title: El título nuevo",
    "Meta description: La descripción que agregó la matriz.",
    "Palabra clave: origen de la palabra angustia",
    "Temas: angustia",
  ].join("\n");

  const result = extractCrmMetadata(documento);

  it("lee todos los bloques y no solo el primero", () => {
    // El caso real: un documento que ya tenía "## Metadatos" y al que la matriz
    // le agregó abajo un bloque actualizado. Antes se leía el primero y el
    // resto se ignoraba en silencio: el archivo traía el dato y la pantalla
    // decía que faltaba.
    expect(result.metadata.metaDescription).toBe("La descripción que agregó la matriz.");
    expect(result.metadata.focusKeyword).toBe("origen de la palabra angustia");
    expect(result.metadata.topics).toEqual(["angustia"]);
  });

  it("gana el último, que es el más reciente", () => {
    expect(result.metadata.metaTitle).toBe("El título nuevo");
  });

  it("conserva lo que solo dijo el bloque viejo", () => {
    expect(result.metadata.excerpt).toBe("El resumen que ya estaba.");
  });

  it("corta el contenido en el primer bloque", () => {
    expect(result.content).toBe("# Artículo\n\nCuerpo.");
  });
});
