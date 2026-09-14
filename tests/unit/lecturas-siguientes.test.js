// tests/unit/lecturas-siguientes.test.js
//
// La garantía que se prueba acá es la que antes no existía: un artículo
// publicado nunca termina sin ningún camino de lectura. Tres de los dieciocho
// artículos publicados estaban en ese caso —sin serie, sin tema y sin
// disciplina— y el pie devolvía `null` entero.
import { describe, it, expect } from "vitest";
import { bloquesDeLectura, completarSugerencias, ofreceLectura } from "../../src/lib/lecturas-siguientes.js";

const post = (id) => ({ id, slug: id, title: id });

describe("completar sugerencias", () => {
  it("pone primero a quien escribe y completa con lo reciente", () => {
    const salida = completarSugerencias([post("a1")], [post("r1"), post("r2")], { limite: 3 });
    expect(salida.map((p) => p.id)).toEqual(["a1", "r1", "r2"]);
  });

  it("no repite un artículo que ya vino por autor", () => {
    const salida = completarSugerencias([post("a1"), post("a2")], [post("a1"), post("r1")], { limite: 3 });
    expect(salida.map((p) => p.id)).toEqual(["a1", "a2", "r1"]);
  });

  it("nunca sugiere el artículo que se está leyendo", () => {
    const salida = completarSugerencias([post("actual"), post("a2")], [post("r1")], { limite: 3, excluir: ["actual"] });
    expect(salida.map((p) => p.id)).toEqual(["a2", "r1"]);
  });

  it("no repite lo que el par cronológico ya ofrece", () => {
    // Sin esto, el artículo que figura como «Anterior» reaparecía dos
    // centímetros más abajo bajo «Seguir leyendo».
    const salida = completarSugerencias([post("anterior"), post("a2")], [post("siguiente"), post("r1")], {
      limite: 3,
      excluir: ["actual", "anterior", "siguiente"],
    });
    expect(salida.map((p) => p.id)).toEqual(["a2", "r1"]);
  });

  it("respeta el límite", () => {
    const salida = completarSugerencias([post("a1"), post("a2"), post("a3"), post("a4")], [], { limite: 3 });
    expect(salida).toHaveLength(3);
  });

  it("aguanta listas vacías o mal formadas", () => {
    expect(completarSugerencias()).toEqual([]);
    expect(completarSugerencias(null, undefined)).toEqual([]);
    expect(completarSugerencias([{ sinId: true }], [])).toEqual([]);
  });
});

describe("bloques de lectura", () => {
  it("la cronología no se muestra cuando el artículo está en una serie", () => {
    // Dos pares de flechas con criterios distintos —orden de la serie y fecha—
    // en el mismo pie no orientan.
    const bloques = bloquesDeLectura({
      series: { name: "Una serie" },
      cronologia: { anterior: post("x"), siguiente: post("y") },
    });
    expect(bloques.serie).toBe(true);
    expect(bloques.cronologia).toBe(false);
  });

  it("la cronología aparece cuando no hay serie", () => {
    expect(bloquesDeLectura({ cronologia: { anterior: post("x"), siguiente: null } }).cronologia).toBe(true);
    expect(bloquesDeLectura({ cronologia: { anterior: null, siguiente: post("y") } }).cronologia).toBe(true);
  });

  it("una cronología sin vecinos no es un bloque", () => {
    expect(bloquesDeLectura({ cronologia: { anterior: null, siguiente: null } }).cronologia).toBe(false);
    expect(bloquesDeLectura({}).cronologia).toBe(false);
  });

  it("distingue etiquetas de lecturas", () => {
    const bloques = bloquesDeLectura({ topics: [{ id: "t" }], disciplines: [] });
    expect(bloques.etiquetas).toBe(true);
    expect(bloques.delMismoTema).toBe(false);
  });
});

describe("ofrece lectura", () => {
  it("las etiquetas solas no son un camino de lectura", () => {
    // Un chip lleva a una biblioteca filtrada, no a un texto. Si lo único que
    // hay son chips, el lector sigue sin un artículo al que ir.
    const bloques = bloquesDeLectura({ topics: [{ id: "t" }], disciplines: [{ id: "d" }] });
    expect(ofreceLectura(bloques)).toBe(false);
  });

  it("basta con la serie", () => {
    expect(ofreceLectura(bloquesDeLectura({ series: { name: "s" } }))).toBe(true);
  });

  it("basta con el par cronológico", () => {
    expect(ofreceLectura(bloquesDeLectura({ cronologia: { anterior: post("x") } }))).toBe(true);
  });

  it("basta con las sugerencias: el caso del artículo sin clasificar", () => {
    // Éste es el caso de los tres artículos de angustia.
    const bloques = bloquesDeLectura({ sugerencias: [post("otro")] });
    expect(ofreceLectura(bloques)).toBe(true);
  });

  it("solo se calla cuando de verdad no hay nada", () => {
    expect(ofreceLectura(bloquesDeLectura({}))).toBe(false);
    expect(ofreceLectura({})).toBe(false);
  });
});
