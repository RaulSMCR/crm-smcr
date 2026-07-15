import { describe, expect, it } from "vitest";
import { assertFeConfig } from "../../src/lib/fe/config.js";

describe("assertFeConfig", () => {
  it("exporta una validación clara para configuración incompleta", () => {
    expect(() => assertFeConfig()).toThrow(/Configuración FE/);
  });
});
