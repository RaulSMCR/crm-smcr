import { describe, it, expect } from "vitest";
import { limpiarAndamiajeEditorial } from "@/lib/limpieza-editorial";

const DOCUMENTO = [
  "**Fase 5 · Artículo 1** · *La angustia y sus formas*",
  "",
  "Extensión total: ~4.900 palabras. Corte en 3 partes.",
  "",
  '**Parte 1: "Un objeto de madera"** — desde la apertura hasta el final. ~1.750w.',
  "",
  '**Parte 2: "Las familias del apretar"** — desde La familia respiratoria. ~1.700w.',
  "",
  "---",
  "",
  "## PARTE 1",
  "",
  "### Un objeto de madera",
  "",
  "Buscando material para un caso nos encontramos con un aparato.",
  "",
  "### Referencias del segmento (APA)",
  "",
  "Corominas, J. (1980). *Diccionario*. Gredos.",
  "",
  "---",
  "",
  "## PARTE 2",
  "",
  "**Puente:** *En la entrega anterior seguimos la palabra angustia hasta su raíz.*",
  "",
  "### La familia respiratoria",
  "",
  "Hay un segundo grupo de palabras castellanas.",
  "",
  "### Referencias del segmento (APA)",
  "",
  "Watkins, C. (2011). *Roots*. Houghton.",
  "",
  "---",
  "",
  "## Referencias generales (APA)",
  "",
  "Corominas, J. (1980). *Diccionario*. Gredos.",
  "",
  "Watkins, C. (2011). *Roots*. Houghton.",
].join("\n");

describe("limpiarAndamiajeEditorial", () => {
  const { contenido, removidos } = limpiarAndamiajeEditorial(DOCUMENTO);

  it("deja solo el ensayo y su bibliografía", () => {
    const titulos = contenido.split("\n").filter((l) => l.startsWith("#"));
    expect(titulos).toEqual([
      "### Un objeto de madera",
      "### La familia respiratoria",
      "## Referencias generales (APA)",
    ]);
  });

  it("conserva la bibliografía completa al final", () => {
    // Es parte del artículo, no andamiaje. Es lo único que respalda un ensayo
    // que afirma cosas sobre etimologías.
    expect(contenido.trimEnd().endsWith("Watkins, C. (2011). *Roots*. Houghton.")).toBe(true);
    expect(contenido).toContain("Corominas");
  });

  it("conserva el cuerpo íntegro", () => {
    expect(contenido).toContain("Buscando material para un caso nos encontramos con un aparato.");
    expect(contenido).toContain("Hay un segundo grupo de palabras castellanas.");
  });

  it("saca la cabecera, el plan de cortes y las marcas de parte", () => {
    expect(contenido).not.toContain("Fase 5");
    expect(contenido).not.toContain("Corte en 3 partes");
    expect(contenido).not.toMatch(/^\s*\*\*Parte 1:/m);
    expect(contenido).not.toMatch(/PARTE 1/);
  });

  it("saca los puentes, que le hablan al lector de otra entrega", () => {
    expect(contenido).not.toContain("Puente");
    expect(contenido).not.toContain("En la entrega anterior");
  });

  it("no deja separadores huérfanos ni renglones en blanco de más", () => {
    expect(contenido).not.toMatch(/\n{3,}/);
    expect(contenido.startsWith("---")).toBe(false);
  });

  it("dice todo lo que sacó", () => {
    expect(removidos).toEqual([
      "la línea de fase y serie",
      "el plan de cortes",
      "2 marcas «PARTE»",
      "1 puente entre entregas",
      "2 bloques de referencias por segmento (sus fuentes quedan en las referencias generales)",
    ]);
  });
});

describe("limpiarAndamiajeEditorial — lo que no toca", () => {
  it("NO quita las referencias por segmento si no hay referencias generales", () => {
    // Sin la lista general, ese bloque es la única bibliografía del artículo.
    // Quitarlo porque parecía repetido sería el peor error posible acá.
    const doc = [
      "### Una sección",
      "",
      "Cuerpo.",
      "",
      "### Referencias del segmento (APA)",
      "",
      "Corominas, J. (1980). *Diccionario*. Gredos.",
    ].join("\n");

    const { contenido, removidos } = limpiarAndamiajeEditorial(doc);
    expect(contenido).toContain("### Referencias del segmento (APA)");
    expect(contenido).toContain("Corominas");
    expect(removidos).toEqual([]);
  });

  it("no confunde prosa del ensayo con el plan de cortes", () => {
    // "Parte 3" al principio de un párrafo, ya dentro del cuerpo, es texto.
    const doc = [
      "### El mapa",
      "",
      "Parte 3: eso es lo que queda por decir, y no es poco.",
      "",
      "La extensión total del problema recién empieza a verse.",
    ].join("\n");

    const { contenido, removidos } = limpiarAndamiajeEditorial(doc);
    expect(contenido).toContain("Parte 3: eso es lo que queda por decir");
    expect(contenido).toContain("La extensión total del problema");
    expect(removidos).toEqual([]);
  });

  it("deja intacto un documento que no trae andamiaje", () => {
    const doc = "### Título\n\nUn párrafo.\n\n### Otro\n\nOtro párrafo.";
    const { contenido, removidos } = limpiarAndamiajeEditorial(doc);
    expect(contenido).toBe(doc);
    expect(removidos).toEqual([]);
  });
});
