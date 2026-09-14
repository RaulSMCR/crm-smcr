import { describe, it, expect } from "vitest";
import { esOrdenable, motivoFueraDeGrilla, resolverOrden } from "@/lib/hub-order";

/**
 * El orden de aparición del hub.
 *
 * Lo que se prueba es lo que duele si se rompe: que el orden quede contiguo (dos
 * módulos con el mismo número dejaban el orden en manos de la base), que una
 * lista vieja no escriba nada, que haya una sola destacada y que las que se
 * apagan se escriban antes de la que se enciende —el índice parcial de la
 * migración no perdona el orden inverso.
 */

function mod(extra = {}) {
  return { id: "m1", slug: "duelo", type: "TOPIC", title: "Duelo", position: 0, isVisible: true, isPublished: true, isFeatured: false, ...extra };
}

const TRES = [
  mod({ id: "a", slug: "duelo", position: 0 }),
  mod({ id: "b", slug: "ansiedad", position: 1 }),
  mod({ id: "c", slug: "pareja", position: 2 }),
];

describe("esOrdenable", () => {
  it("el módulo de copy del hub no es una pieza que se ordene", () => {
    expect(esOrdenable(mod({ slug: "_hub" }))).toBe(false);
    expect(esOrdenable(mod())).toBe(true);
  });
});

describe("motivoFueraDeGrilla", () => {
  it("un tema visible y publicado se ve", () => {
    expect(motivoFueraDeGrilla(mod())).toBeNull();
  });

  it("dice por qué no se ve, y el borrador lo dice con esas palabras", () => {
    expect(motivoFueraDeGrilla(mod({ isPublished: false }))).toContain("borrador");
    expect(motivoFueraDeGrilla(mod({ isVisible: false }))).toContain("oculto");
    expect(motivoFueraDeGrilla(mod({ type: "TREATMENT" }))).toContain("propia sección");
    expect(motivoFueraDeGrilla(mod({ type: "CUSTOM" }))).toContain("tarjeta");
  });
});

describe("resolverOrden", () => {
  it("renumera contiguo y solo escribe lo que cambia", () => {
    const { escrituras } = resolverOrden(TRES, { orden: ["c", "a", "b"] });
    expect(escrituras).toEqual([
      { id: "c", position: 0 },
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ]);
  });

  it("el mismo orden no escribe nada", () => {
    expect(resolverOrden(TRES, { orden: ["a", "b", "c"] }).escrituras).toEqual([]);
  });

  it("deja contiguos unos números que estaban sueltos", () => {
    const sueltos = [mod({ id: "a", position: 7 }), mod({ id: "b", position: 7 }), mod({ id: "c", position: 30 })];
    const { escrituras } = resolverOrden(sueltos, { orden: ["a", "b", "c"] });
    expect(escrituras.map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it("rechaza una lista incompleta en vez de renumerar a medias", () => {
    const salida = resolverOrden(TRES, { orden: ["a", "b"] });
    expect(salida.error).toContain("incompleta");
    expect(salida.escrituras).toBeUndefined();
  });

  it("rechaza ids que no son del hub", () => {
    expect(resolverOrden(TRES, { orden: ["a", "b", "z"] }).error).toBeTruthy();
  });

  it("ignora el módulo de copy al exigir la lista completa", () => {
    const conCopy = [...TRES, mod({ id: "copy", slug: "_hub", position: 999 })];
    expect(resolverOrden(conCopy, { orden: ["a", "b", "c"] }).escrituras).toEqual([]);
  });

  it("apaga la destacada anterior antes de encender la nueva", () => {
    const conDestacada = [mod({ id: "a", isFeatured: true }), mod({ id: "b", position: 1 })];
    const { escrituras } = resolverOrden(conDestacada, { orden: ["a", "b"], destacada: "b" });
    expect(escrituras).toEqual([
      { id: "a", isFeatured: false },
      { id: "b", isFeatured: true },
    ]);
  });

  it("quitar el destaque no enciende ninguna otra", () => {
    const conDestacada = [mod({ id: "a", isFeatured: true }), mod({ id: "b", position: 1 })];
    const { escrituras } = resolverOrden(conDestacada, { orden: ["a", "b"], destacada: null });
    expect(escrituras).toEqual([{ id: "a", isFeatured: false }]);
  });

  it("solo un tema puede ser la destacada", () => {
    const conTratamiento = [mod({ id: "a" }), mod({ id: "b", type: "TREATMENT", position: 1 })];
    expect(resolverOrden(conTratamiento, { orden: ["a", "b"], destacada: "b" }).error).toContain("tema");
  });

  it("mueve y destaca la misma pieza en una sola escritura", () => {
    const { escrituras } = resolverOrden(TRES, { orden: ["c", "a", "b"], destacada: "c" });
    expect(escrituras.filter((item) => item.id === "c")).toEqual([{ id: "c", position: 0, isFeatured: true }]);
    expect(escrituras[escrituras.length - 1].id).toBe("c");
  });

  it("sin orden no hace nada", () => {
    expect(resolverOrden(TRES, {}).error).toBeTruthy();
  });
});
