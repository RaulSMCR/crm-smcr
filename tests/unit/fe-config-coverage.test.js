import { describe, expect, it, vi } from "vitest";

describe("assertFeConfig coverage", () => {
  it("acepta una configuración completa de staging", async () => {
    vi.resetModules();
    const values = {
      FE_EMISOR_NOMBRE: "SMCR", FE_EMISOR_TIPO_ID: "02", FE_EMISOR_IDENTIFICACION: "310100000000",
      FE_EMISOR_CORREO: "fe@example.cr", FE_EMISOR_TEL_CODIGO: "506", FE_EMISOR_TEL_NUMERO: "70000000",
      FE_EMISOR_PROVINCIA: "1", FE_EMISOR_CANTON: "01", FE_EMISOR_DISTRITO: "01", FE_EMISOR_OTRAS_SENAS: "San José",
      FE_EMISOR_ACTIVIDAD: "620101", FE_EMISOR_SUCURSAL: "001", FE_EMISOR_TERMINAL: "00001", FE_AMBIENTE: "02",
      FE_TOKEN_URL: "https://token", FE_API_URL: "https://receive", FE_CLIENT_ID: "client", FE_USERNAME: "user",
      FE_PASSWORD: "password", FE_P12_BASE64: "certificate", FE_P12_PIN: "1234",
    };
    const previous = {};
    for (const [key, value] of Object.entries(values)) { previous[key] = process.env[key]; process.env[key] = value; }
    const config = await import("@/lib/fe/config");
    expect(config.assertFeConfig()).toBe(true);
    expect(config.TIPO_DOC_MAP.CUSTOMER_INVOICE).toBe("01");
    for (const key of Object.keys(values)) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  });
});
