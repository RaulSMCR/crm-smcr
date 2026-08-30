import { describe, it, expect } from "vitest";
import { formatearIban, normalizarIban, validarIban } from "@/lib/iban";

// IBAN de Costa Rica con dígitos de control correctos.
const IBAN_CR = "CR05015202001026284066";

describe("IBAN del profesional", () => {
  it("acepta un IBAN válido con o sin espacios", () => {
    expect(validarIban(IBAN_CR).valido).toBe(true);
    expect(validarIban("cr05 0152 0200 1026 2840 66").valido).toBe(true);
  });

  it("lo guarda normalizado y lo muestra agrupado", () => {
    expect(normalizarIban("cr05 0152-0200 1026 2840 66")).toBe(IBAN_CR);
    expect(formatearIban(IBAN_CR)).toBe("CR05 0152 0200 1026 2840 66");
  });

  it("rechaza un dígito cambiado, que es el error que de verdad pasa", () => {
    // Un IBAN mal tipeado no rebota: el dinero va a otra cuenta o a ninguna.
    const conErrata = IBAN_CR.slice(0, 10) + "9" + IBAN_CR.slice(11);
    const revision = validarIban(conErrata);
    expect(revision.valido).toBe(false);
    expect(revision.error).toMatch(/dígitos de control/i);
  });

  it("rechaza un IBAN de Costa Rica con el largo equivocado", () => {
    const revision = validarIban(IBAN_CR.slice(0, 20));
    expect(revision.valido).toBe(false);
    expect(revision.error).toMatch(/22 caracteres/);
  });

  it("rechaza lo que ni siquiera parece un IBAN", () => {
    expect(validarIban("12345678901234567890").valido).toBe(false);
    expect(validarIban("").error).toMatch(/Falta/);
  });

  it("no obliga a que sea de Costa Rica", () => {
    // Un profesional puede tener cuenta fuera del país.
    const revision = validarIban("DE89370400440532013000");
    expect(revision.valido).toBe(true);
    expect(revision.esCostaRica).toBe(false);
  });
});
