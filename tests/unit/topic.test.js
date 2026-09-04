import { describe, expect, it } from "vitest";
import {
  isReservedTopicSlug,
  normalizeTopicSlug,
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
      "Debe existir una sección visible de introducción editorial.",
      "Debe existir al menos un contenido relacionado aprobado.",
    ]));
  });
});
