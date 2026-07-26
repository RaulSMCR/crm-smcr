import { describe, it, expect } from "vitest";
import {
  DIAS_DE_AVISO_DE_RENOVACION,
  PRIMER_DIA,
  ULTIMO_DIA,
  estadoDeVigencia,
} from "@/lib/frases";

describe("vigencia del corpus", () => {
  it("no molesta mientras sobra material", () => {
    const v = estadoDeVigencia("2026-10-10");
    expect(v.requiereRenovacion).toBe(false);
    expect(v.vencido).toBe(false);
    expect(v.diasRestantes).toBeGreaterThan(300);
  });

  it("avisa 45 días antes de que se agote", () => {
    // El corpus termina el 14-ago-2027.
    expect(estadoDeVigencia("2027-06-29").requiereRenovacion).toBe(false);
    expect(estadoDeVigencia("2027-06-30").requiereRenovacion).toBe(true);
    expect(estadoDeVigencia("2027-06-30").diasRestantes).toBe(DIAS_DE_AVISO_DE_RENOVACION);
  });

  it("el aviso ya está encendido el 1.º de agosto, con margen", () => {
    const v = estadoDeVigencia("2027-08-01");
    expect(v.requiereRenovacion).toBe(true);
    expect(v.vencido).toBe(false);
    expect(v.diasRestantes).toBe(13);
  });

  it("marca vencido cuando el corpus ya se acabó", () => {
    const v = estadoDeVigencia("2027-08-15");
    expect(v.vencido).toBe(true);
    expect(v.requiereRenovacion).toBe(true);
    expect(v.diasRestantes).toBeLessThan(0);
  });

  it("el último día todavía tiene material", () => {
    const v = estadoDeVigencia(ULTIMO_DIA);
    expect(v.vencido).toBe(false);
    expect(v.diasRestantes).toBe(0);
  });

  it("reporta la ventana y la versión del corpus", () => {
    const v = estadoDeVigencia("2026-10-10");
    expect(v.primerDia).toBe(PRIMER_DIA);
    expect(v.ultimoDia).toBe(ULTIMO_DIA);
    expect(v.version).toBe(`${PRIMER_DIA}_${ULTIMO_DIA}`);
  });
});
