import { describe, expect, it, vi } from "vitest";

// `FE_EMISOR` y `FE_API` se arman al importar el módulo, así que cada caso
// prepara su entorno y reimporta. Es el mismo patrón de fe-config-coverage.
async function diagnosticarCon(values) {
  vi.resetModules();
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    const { diagnosticarFeConfig } = await import("@/lib/fe/config");
    return diagnosticarFeConfig();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const COMPLETA = {
  FE_EMISOR_NOMBRE: "SMCR", FE_EMISOR_TIPO_ID: "02", FE_EMISOR_IDENTIFICACION: "310100000000",
  FE_EMISOR_CORREO: "fe@example.cr", FE_EMISOR_TEL_CODIGO: "506", FE_EMISOR_TEL_NUMERO: "70000000",
  FE_EMISOR_PROVINCIA: "1", FE_EMISOR_CANTON: "01", FE_EMISOR_DISTRITO: "01",
  FE_EMISOR_OTRAS_SENAS: "San José", FE_EMISOR_ACTIVIDAD: "8690.9",
  FE_EMISOR_SUCURSAL: "001", FE_EMISOR_TERMINAL: "00001", FE_AMBIENTE: "02",
  FE_TOKEN_URL: "https://idp.example/token", FE_API_URL: "https://api.example/recepcion",
  FE_CLIENT_ID: "api-stag", FE_USERNAME: "usuario", FE_PASSWORD: "secreto-de-hacienda",
  FE_P12_BASE64: "YmFzZTY0", FE_P12_PIN: "9999",
  ONVO_SECRET_KEY: "onvo_test_abc", FISCAL_AMBIENTE_MIXTO: undefined,
};

describe("diagnóstico de la configuración fiscal", () => {
  it("nombra las variables que faltan, separando emisor de API", async () => {
    const d = await diagnosticarCon({ ...COMPLETA, FE_API_URL: undefined, FE_EMISOR_CORREO: undefined });
    expect(d.completa).toBe(false);
    expect(d.faltantes.emisor).toEqual(["FE_EMISOR_CORREO"]);
    expect(d.faltantes.api).toEqual(["FE_API_URL"]);
  });

  // La razón de ser de esta función es decir qué falta sin publicar nada: el
  // módulo de emisión oculta el texto de sus excepciones justamente porque
  // puede arrastrar contenido del comprobante.
  it("no devuelve ningún valor, solo nombres", async () => {
    const d = await diagnosticarCon({ ...COMPLETA, FE_EMISOR_IDENTIFICACION: "3-101-000000" });
    const serializado = JSON.stringify(d);
    for (const secreto of ["secreto-de-hacienda", "YmFzZTY0", "9999", "onvo_test_abc", "3-101-000000"]) {
      expect(serializado).not.toContain(secreto);
    }
  });

  it("señala la regla incumplida sin repetir lo que ya está ausente", async () => {
    const d = await diagnosticarCon({ ...COMPLETA, FE_EMISOR_IDENTIFICACION: "3-101-000000", FE_EMISOR_ACTIVIDAD: undefined });
    // La identificación con guiones es UN problema: `FE_PROVEEDOR_SISTEMAS` la
    // hereda cuando no se declara, y señalarla aparte mandaría a revisar una
    // variable que nadie configuró.
    expect(d.formato.map((f) => f.variable)).toEqual(["FE_EMISOR_IDENTIFICACION"]);
    expect(d.faltantes.emisor).toContain("FE_EMISOR_ACTIVIDAD");
  });

  it("sí señala FE_PROVEEDOR_SISTEMAS cuando se declaró y está mal", async () => {
    const d = await diagnosticarCon({ ...COMPLETA, FE_PROVEEDOR_SISTEMAS: "3-101-000000" });
    expect(d.formato.map((f) => f.variable)).toEqual(["FE_PROVEEDOR_SISTEMAS"]);
  });

  it("detecta cobros en producción con facturación en pruebas", async () => {
    const d = await diagnosticarCon({ ...COMPLETA, ONVO_SECRET_KEY: "onvo_live_abc" });
    expect(d.ambiente.coherente).toBe(false);
    expect(d.ambiente.problema).toMatch(/Incoherencia/);
    expect(d.completa).toBe(false);
  });

  it("avisa cuando ONVO cobra de verdad y no hay ambiente fiscal declarado", async () => {
    const d = await diagnosticarCon({ ...COMPLETA, FE_AMBIENTE: undefined, ONVO_SECRET_KEY: "onvo_live_abc" });
    expect(d.ambiente.problema).toMatch(/sin poder emitir el comprobante/);
  });

  it("acepta la mezcla declarada a propósito, pero la deja registrada", async () => {
    const d = await diagnosticarCon({ ...COMPLETA, ONVO_SECRET_KEY: "onvo_live_abc", FISCAL_AMBIENTE_MIXTO: "1" });
    expect(d.ambiente.problema).toBeNull();
    expect(d.ambiente.mixtoPermitido).toBe(true);
    expect(d.completa).toBe(true);
  });

  it("da por completa una configuración de pruebas coherente", async () => {
    const d = await diagnosticarCon(COMPLETA);
    expect(d).toMatchObject({ completa: true, formato: [] });
    expect(d.ambiente).toMatchObject({ fe: "pruebas", cobros: "pruebas", coherente: true });
  });
});
