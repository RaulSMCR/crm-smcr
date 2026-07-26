import { describe, it, expect } from "vitest";
import { fraseDeIndice, indiceDeTexto, reconciliarIndice } from "@/lib/frases";

const real = fraseDeIndice(870);

describe("reconciliación de índices tras regenerar el corpus", () => {
  it("deja pasar una elección cuyo índice sigue siendo correcto", () => {
    const r = reconciliarIndice({ phraseIndex: 870, phraseText: real.texto, status: "APPROVED" });
    expect(r).toEqual({ phraseIndex: 870, desfasada: false, huerfana: false });
  });

  it("recupera el índice por texto cuando las posiciones se movieron", () => {
    // Es el caso real: al sumar Sloterdijk y Ortega, la frase de Victor Hugo
    // pasó del índice 849 al 870.
    const r = reconciliarIndice({ phraseIndex: 849, phraseText: real.texto, status: "APPROVED" });
    expect(r.phraseIndex).toBe(870);
    expect(r.desfasada).toBe(true);
    expect(r.huerfana).toBe(false);
  });

  it("marca como huérfana una frase que ya no está en el corpus", () => {
    const r = reconciliarIndice({
      phraseIndex: 12,
      phraseText: "Una frase que nunca existió en ningún corpus",
      status: "APPROVED",
    });
    expect(r.phraseIndex).toBe(-1);
    expect(r.huerfana).toBe(true);
  });

  it("no toca los días marcados sin publicación", () => {
    const r = reconciliarIndice({ phraseIndex: -1, phraseText: "", status: "SKIPPED" });
    expect(r).toEqual({ phraseIndex: -1, desfasada: false, huerfana: false });
  });

  it("tolera la ausencia de elección", () => {
    expect(reconciliarIndice(null).phraseIndex).toBe(-1);
  });

  it("indiceDeTexto es la inversa exacta de fraseDeIndice", () => {
    for (const i of [0, 5, 400, 870, 1144]) {
      expect(indiceDeTexto(fraseDeIndice(i).texto)).toBe(i);
    }
    expect(indiceDeTexto("no existe")).toBe(-1);
  });
});
