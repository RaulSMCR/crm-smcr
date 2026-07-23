import { describe, expect, it } from "vitest";
import { buildEditorialPackage, stripHtmlToText } from "@/lib/editorial-package";

describe("editorial package", () => {
  it("converts article HTML to readable text", () => {
    expect(stripHtmlToText("<h1>Título</h1><p>Texto &amp; contexto.</p>")).toBe("Título\n Texto & contexto.");
  });

  it("builds the required manual package files", () => {
    const result = buildEditorialPackage({
      article: {
        id: "post-1",
        title: "Artículo",
        slug: "articulo",
        content: "<p>Contenido</p>",
        status: "PUBLISHED",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      carousel: {
        id: "carousel-1",
        title: "Carrusel",
        status: "DRAFT",
        spec: { title: "Carrusel", slides: [{ type: "cover", title: "Portada" }] },
      },
      assets: [],
    });

    expect(result.files.map((file) => file.name)).toEqual([
      "article.md",
      "article.json",
      "carousel.json",
      "brand-context.md",
      "instructions.md",
      "assets-manifest.json",
    ]);
    expect(result.carouselJson.carousel.slides[0].slideId).toBe("slide-01");
  });
});
