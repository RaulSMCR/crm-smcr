import { describe, expect, it, vi } from "vitest";
import { splitTaxIncluded } from "../../src/lib/invoice-math.js";
import { validateSupplierFeClave } from "../../src/lib/supplier-invoice.js";

// Clave de 50 dígitos con la estructura oficial de Hacienda:
// país(3) + fecha ddmmaa(6) + cédula(12) + consecutivo(20) + situación(1) + seguridad(8)
const buildClave = ({
  pais = "506",
  fecha = "150726",
  cedula = "000310123456",
  consecutivo = "00100001010000000001",
  situacion = "1",
  seguridad = "12345678",
} = {}) => `${pais}${fecha}${cedula}${consecutivo}${situacion}${seguridad}`;

describe("factura de proveedor", () => {
  it("acepta una clave real con la cédula del profesional", () => {
    const clave = buildClave();
    expect(clave).toHaveLength(50);
    expect(validateSupplierFeClave(clave, "310123456")).toEqual({ ok: true });
  });

  it("acepta una cédula corta rellenada con ceros a la izquierda", () => {
    expect(validateSupplierFeClave(buildClave({ cedula: "000000012345" }), "12345").ok).toBe(true);
  });

  it("rechaza una clave cuya cédula pertenece a otro emisor", () => {
    const result = validateSupplierFeClave(buildClave({ cedula: "000399999999" }), "310123456");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no coincide/);
  });

  it("rechaza claves que no tienen exactamente 50 dígitos", () => {
    expect(validateSupplierFeClave(buildClave({ seguridad: "1234567" }), "310123456").ok).toBe(false);
    expect(validateSupplierFeClave(buildClave({ seguridad: "123456789" }), "310123456").ok).toBe(false);
    expect(validateSupplierFeClave("123", "310123456").ok).toBe(false);
  });

  it("exige la identificación del profesional", () => {
    const result = validateSupplierFeClave(buildClave(), "");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/identificación en el perfil/);
  });

  // Coherencia cruzada: la posición de la cédula debe ser la misma que usa el generador
  // de claves del proyecto, para que ambas piezas no puedan volver a divergir.
  it("extrae la cédula de la misma posición que buildFeClave", async () => {
    vi.resetModules();
    const previous = process.env.FE_EMISOR_IDENTIFICACION;
    process.env.FE_EMISOR_IDENTIFICACION = "310123456";
    try {
      const { buildFeClave } = await import("@/lib/fe/xml");
      const clave = buildFeClave("01", "00100001010000000001", new Date(2026, 6, 15), "12345678");
      expect(clave).toHaveLength(50);
      expect(validateSupplierFeClave(clave, "310123456")).toEqual({ ok: true });
    } finally {
      if (previous === undefined) delete process.env.FE_EMISOR_IDENTIFICACION;
      else process.env.FE_EMISOR_IDENTIFICACION = previous;
    }
  });
});

describe("IVA incluido", () => {
  it("desglosa IVA incluido al 4%", () => {
    expect(splitTaxIncluded(10400, 4)).toEqual({ baseCents: 10000, taxCents: 400 });
  });
});
