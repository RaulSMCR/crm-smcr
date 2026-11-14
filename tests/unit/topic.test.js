import { describe, expect, it } from "vitest";
import {
  isReservedTopicSlug,
  normalizeTopicSlug,
  ordenarBloquesHub,
  topicPublicationIssues,
  validateTopicSlug,
} from "../../src/lib/topic";

describe("topic hubs", () => {
  it("normaliza slugs conservando palabras con acento", () => {
    expect(normalizeTopicSlug("Ejercicio y salud mental")).toBe("ejercicio-y-salud-mental");
    expect(validateTopicSlug("ejercicio-y-salud-mental")).toBeNull();
  });

  it("impide que un Topic ocupe una ruta reservada", () => {
    expect(isReservedTopicSlug("blog")).toBe(true);
    expect(validateTopicSlug("panel")).toContain("reservado");
    expect(validateTopicSlug("ansiedad")).toBeNull();
  });

  it("bloquea publicación sin requisitos editoriales", () => {
    const issues = topicPublicationIssues({ name: "Ansiedad" }, { sections: [] });
    expect(issues).toEqual(expect.arrayContaining([
      "Falta el título del hub.",
      "Falta el extracto editorial.",
      "Falta el título SEO.",
      "Falta la meta description.",
    ]));
    expect(issues.some((issue) => issue.startsWith("Ninguna sección es de tipo «Introducción editorial»"))).toBe(true);
    expect(issues.some((issue) => issue.startsWith("Falta contenido relacionado"))).toBe(true);
  });

  it("distingue una introducción oculta de una inexistente", () => {
    const issues = topicPublicationIssues({}, { sections: [{ type: "EDITORIAL_INTRO", isVisible: false, body: "Texto" }] });
    expect(issues.some((issue) => issue.includes("está oculta"))).toBe(true);
    expect(issues.some((issue) => issue.startsWith("Ninguna sección"))).toBe(false);
  });

  it("ordena los bloques por posición y deja al final los que no tienen sección", () => {
    const orden = ordenarBloquesHub([
      { key: "FAQ", rank: 7, position: undefined },
      { key: "texto-b", rank: 11, position: 2 },
      { key: "EDITORIAL_INTRO", rank: 1, position: 0 },
      { key: "SERVICES", rank: 8, position: null },
      { key: "texto-a", rank: 11, position: 1 },
    ]).map((bloque) => bloque.key);
    expect(orden).toEqual(["EDITORIAL_INTRO", "texto-a", "texto-b", "FAQ", "SERVICES"]);
  });

  it("con posiciones empatadas conserva el orden de referencia", () => {
    const orden = ordenarBloquesHub([
      { key: "custom", rank: 11, position: 0 },
      { key: "EDITORIAL_INTRO", rank: 1, position: 0 },
      { key: "USER_SITUATIONS", rank: 0, position: 0 },
    ]).map((bloque) => bloque.key);
    expect(orden).toEqual(["USER_SITUATIONS", "EDITORIAL_INTRO", "custom"]);
  });
});
