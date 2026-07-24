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
});

