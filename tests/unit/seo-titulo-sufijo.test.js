// tests/unit/seo-titulo-sufijo.test.js
//
// El layout raíz declara `title.template: "%s | Salud Mental Costa Rica"`, así
// que lo que se escribe en «Título SEO» no es lo que sale en el buscador: salen
// 26 caracteres más. Los contadores del panel medían el campo contra 60 e
// ignoraban el sufijo, de modo que un título que el panel daba por bueno
// llegaba a Google con 80 y se cortaba. Comprobado contra producción: el título
// de un artículo mide 75 caracteres.
import { describe, it, expect } from "vitest";
import { SEO_LIMITS, TITLE_FIELD_LIMITS, TITLE_SUFFIX, tituloEnBuscador } from "../../src/lib/seo.js";

describe("sufijo del título", () => {
  it("es exactamente el del layout raíz", () => {
    expect(TITLE_SUFFIX).toBe(" | Salud Mental Costa Rica");
    expect(TITLE_SUFFIX).toHaveLength(26);
  });

  it("el presupuesto del campo descuenta el sufijo", () => {
    expect(TITLE_FIELD_LIMITS.max).toBe(SEO_LIMITS.title.max - TITLE_SUFFIX.length);
    expect(TITLE_FIELD_LIMITS.max).toBe(34);
  });

  it("un título que llena el presupuesto cabe entero en el buscador", () => {
    const campo = "x".repeat(TITLE_FIELD_LIMITS.max);
    expect(tituloEnBuscador(campo)).toHaveLength(SEO_LIMITS.title.max);
  });

  it("uno que llena los 60 del campo se pasa, que era el error", () => {
    const campo = "x".repeat(SEO_LIMITS.title.max);
    expect(tituloEnBuscador(campo).length).toBeGreaterThan(SEO_LIMITS.title.max);
  });
});

describe("título en el buscador", () => {
  it("agrega la marca a lo escrito", () => {
    expect(tituloEnBuscador("Psicoanálisis en Costa Rica")).toBe(
      "Psicoanálisis en Costa Rica | Salud Mental Costa Rica",
    );
  });

  it("cae al título visible cuando el campo va vacío", () => {
    expect(tituloEnBuscador("", "Diagnóstico y DSM")).toBe("Diagnóstico y DSM | Salud Mental Costa Rica");
    expect(tituloEnBuscador("   ", "Diagnóstico y DSM")).toContain("Diagnóstico y DSM");
  });

  it("no inventa una marca suelta cuando no hay nada que titular", () => {
    // Devolver solo « | Salud Mental Costa Rica» en la vista previa sería peor
    // que no mostrar nada: parecería un título válido.
    expect(tituloEnBuscador("", "")).toBe("");
    expect(tituloEnBuscador(null, undefined)).toBe("");
  });

  it("recorta los espacios de los extremos", () => {
    expect(tituloEnBuscador("  Duelo  ")).toBe("Duelo | Salud Mental Costa Rica");
  });
});

describe("línea editorial en los hubs de tema", () => {
  // La regla que Raúl fijó el 2026-08-27: la copy no encabeza con cuadros
  // clínicos mientras no existan artículos que los desarrollen. El test que ya
  // existía cubría home y blog; los hubs de tema son la superficie donde más
  // fácil se rompe, porque el nombre del tema *es* el título.
  const CUADROS = /\b(ansiedad|depresi[oó]n|trastorno|s[ií]ndrome|estr[eé]s postraum)/i;

  it.each([
    "Psicoanálisis en Costa Rica",
    "Diagnóstico y DSM en salud mental",
    "Psicoterapia psicoanalítica",
  ])("«%s» respeta la línea", (titulo) => {
    expect(titulo).not.toMatch(CUADROS);
    expect(tituloEnBuscador(titulo).length).toBeLessThanOrEqual(SEO_LIMITS.title.max);
  });

  it("detecta un título que la rompería", () => {
    expect("Ansiedad en Costa Rica").toMatch(CUADROS);
  });
});
