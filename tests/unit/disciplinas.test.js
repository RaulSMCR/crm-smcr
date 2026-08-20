import { describe, it, expect } from "vitest";
import { DISCIPLINAS, esDisciplinaValida, tituloDe, disciplinaPorNombre } from "@/lib/disciplinas";

describe("catálogo de disciplinas", () => {
  it("no tiene ids ni nombres repetidos", () => {
    expect(new Set(DISCIPLINAS.map((d) => d.id)).size).toBe(DISCIPLINAS.length);
    expect(new Set(DISCIPLINAS.map((d) => d.nombre)).size).toBe(DISCIPLINAS.length);
  });

  it("distingue disciplina de título, que es todo el punto", () => {
    // Poner la disciplina como jobTitle es como decir que el puesto de alguien
    // es "Contabilidad".
    expect(tituloDe("Psicología clínica")).toBe("Psicólogo clínico");
    expect(tituloDe("Nutrición")).toBe("Nutricionista");
    expect(tituloDe("Musicoterapia")).toBe("Musicoterapeuta");
  });

  it("acepta variaciones de mayúsculas al buscar", () => {
    expect(disciplinaPorNombre("PSICOLOGÍA CLÍNICA")?.id).toBe("psicologia-clinica");
    expect(disciplinaPorNombre("  Nutrición  ")?.id).toBe("nutricion");
  });

  it("valida contra el catálogo", () => {
    expect(esDisciplinaValida("Psiquiatría")).toBe(true);
    expect(esDisciplinaValida("Psicólogo")).toBe(false); // era una de las 4 grafías viejas
    expect(esDisciplinaValida("")).toBe(false);
  });

  it("devuelve el valor crudo si no está en el catálogo, sin inventar un título", () => {
    // En YMYL, una credencial inventada es peor que una imprecisa.
    expect(tituloDe("Disciplina que no existe")).toBe("Disciplina que no existe");
    expect(tituloDe("")).toBe("");
    expect(tituloDe(null)).toBe("");
  });
});
