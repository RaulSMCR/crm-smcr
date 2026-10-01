// tests/unit/cuentas-de-cobro.test.js
// El catálogo de cuentas por las que entra un pago reportado a mano, y su
// traducción al medio de pago que exige la 4.4.
import { describe, it, expect } from "vitest";
import { CUENTAS_DE_COBRO, cuentaDeCobro, opcionesDeCuenta } from "@/lib/cuentas-de-cobro";
import { MEDIO_PAGO_MAP } from "@/lib/fe/config";

describe("catálogo de cuentas de cobro", () => {
  it("toda cuenta traduce a un código de MedioPago de Hacienda", () => {
    const cuentas = Object.values(CUENTAS_DE_COBRO);
    expect(cuentas.length).toBeGreaterThan(0);
    for (const cuenta of cuentas) {
      // Si una cuenta trajera un medio de pago que el mapa no conoce, el XML
      // saldría con el 04 por defecto: una transferencia declarada donde hubo
      // efectivo, y sin aviso.
      expect(MEDIO_PAGO_MAP[cuenta.medioPago], `cuenta ${cuenta.codigo}`).toBeDefined();
      expect(cuenta.etiqueta.trim().length).toBeGreaterThan(2);
    }
  });

  it("el SINPE Móvil se declara con su propio código y no como transferencia", () => {
    expect(MEDIO_PAGO_MAP[CUENTAS_DE_COBRO.SINPE_MOVIL.medioPago]).toBe("06");
    expect(MEDIO_PAGO_MAP[CUENTAS_DE_COBRO.TRANSFERENCIA_BAC.medioPago]).toBe("04");
    expect(MEDIO_PAGO_MAP[CUENTAS_DE_COBRO.EFECTIVO.medioPago]).toBe("01");
  });

  it("acepta el código sin importar espacios ni minúsculas", () => {
    expect(cuentaDeCobro(" sinpe_movil ")?.codigo).toBe("SINPE_MOVIL");
  });

  it("devuelve null —y no lanza— ante una cuenta que no existe", () => {
    expect(cuentaDeCobro("CUENTA_DE_OTRO")).toBeNull();
    expect(cuentaDeCobro("")).toBeNull();
    expect(cuentaDeCobro(undefined)).toBeNull();
  });

  it("las opciones del panel traen código y etiqueta de cada cuenta", () => {
    const opciones = opcionesDeCuenta();
    expect(opciones).toHaveLength(Object.keys(CUENTAS_DE_COBRO).length);
    expect(opciones.every((o) => o.codigo && o.etiqueta)).toBe(true);
  });
});
