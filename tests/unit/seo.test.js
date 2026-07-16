import { describe, expect, it } from "vitest";
import {
  SEO_LIMITS,
  resolveSeo,
  buildMetadata,
  scoreTitle,
  scoreDescription,
  checkKeyword,
  auditItem,
} from "../../src/lib/seo.js";

describe("resolveSeo", () => {
  it("usa el override editorial cuando está presente", () => {
    const r = resolveSeo(
      { metaTitle: "Título SEO", metaDescription: "Desc editorial", ogImage: "/custom.png", noindex: true },
      { title: "Título contenido", description: "Desc contenido", image: "/fallback.png" },
    );
    expect(r.title).toBe("Título SEO");
    expect(r.description).toBe("Desc editorial");
    expect(r.image).toBe("/custom.png");
    expect(r.noindex).toBe(true);
  });

  it("cae al contenido cuando el override va vacío", () => {
    const r = resolveSeo(
      { metaTitle: "", metaDescription: "  ", ogImage: null },
      { title: "Título contenido", description: "Desc contenido", image: "/fallback.png" },
    );
    expect(r.title).toBe("Título contenido");
    expect(r.description).toBe("Desc contenido");
    expect(r.image).toBe("/fallback.png");
    expect(r.noindex).toBe(false);
  });

  it("cae a la imagen por defecto si no hay ninguna", () => {
    const r = resolveSeo({}, { title: "X", description: "Y" });
    expect(r.image).toBe("/og-image.png");
  });

  it("recorta la descripción al máximo permitido", () => {
    const long = "a".repeat(300);
    const r = resolveSeo({ metaDescription: long }, {});
    expect(r.description.length).toBeLessThanOrEqual(SEO_LIMITS.description.max);
  });
});

describe("buildMetadata", () => {
  it("arma canonical, openGraph y twitter", () => {
    const m = buildMetadata({ title: "Hola", description: "Mundo", path: "blog/x" });
    expect(m.alternates.canonical).toMatch(/\/blog\/x$/);
    expect(m.openGraph.title).toContain("Salud Mental Costa Rica");
    expect(m.twitter.card).toBe("summary_large_image");
    expect(m.robots).toBeUndefined();
  });

  it("emite robots noindex cuando corresponde", () => {
    const m = buildMetadata({ title: "Hola", description: "Mundo", noindex: true });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});

describe("scoreTitle / scoreDescription", () => {
  it("marca error cuando falta el título", () => {
    expect(scoreTitle("").level).toBe("error");
  });
  it("marca warn cuando el título es corto", () => {
    expect(scoreTitle("corto").level).toBe("warn");
  });
  it("marca ok en el rango recomendado", () => {
    const okTitle = "x".repeat(SEO_LIMITS.title.min + 5);
    expect(scoreTitle(okTitle).level).toBe("ok");
  });
  it("marca error cuando falta la descripción y warn si es larga", () => {
    expect(scoreDescription("").level).toBe("error");
    expect(scoreDescription("y".repeat(SEO_LIMITS.description.max + 10)).level).toBe("warn");
  });
});

describe("checkKeyword", () => {
  it("ignora mayúsculas y acentos", () => {
    expect(checkKeyword("Nutrición Clínica en Costa Rica", "nutricion")).toBe(true);
    expect(checkKeyword("Terapia online", "psicología")).toBe(false);
  });
  it("es falso con keyword vacía", () => {
    expect(checkKeyword("cualquier cosa", "")).toBe(false);
  });
});

describe("auditItem", () => {
  it("ordena lo peor primero vía severity", () => {
    const bueno = auditItem({
      title: "x".repeat(40),
      description: "y".repeat(120),
      excerpt: "hay",
      image: "/a.png",
      focusKeyword: "yyyy",
      bodyText: "yyyy yyyy",
    });
    const malo = auditItem({ title: "", description: "", focusKeyword: "zzz", bodyText: "nada" });
    expect(malo.severity).toBeGreaterThan(bueno.severity);
    expect(bueno.ok).toBe(true);
  });

  it("detecta keyword bien colocada como OK", () => {
    const r = auditItem({
      title: "Guía de nutrición",
      description: "Todo sobre nutrición saludable en Costa Rica para tu bienestar diario hoy",
      excerpt: "sí",
      image: "/x.png",
      focusKeyword: "nutrición",
      bodyText: "La nutrición importa",
    });
    const kw = r.issues.find((i) => i.code === "keyword");
    expect(kw.level).toBe("ok");
  });

  it("marca noindex como issue", () => {
    const r = auditItem({ title: "x".repeat(40), description: "y".repeat(120), excerpt: "a", image: "/i.png", focusKeyword: "y", bodyText: "y y", noindex: true });
    expect(r.issues.some((i) => i.code === "noindex")).toBe(true);
  });
});
