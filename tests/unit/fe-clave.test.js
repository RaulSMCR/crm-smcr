import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// FE_EMISOR se congela al importar config.js, así que el entorno va antes del import.
const EMISOR = { sucursal: "001", terminal: "00001", identificacion: "3101234567" };

let buildFeClave;
let buildFeNumber;
let extractConsecutivo;

beforeAll(async () => {
  vi.stubEnv("FE_EMISOR_SUCURSAL", EMISOR.sucursal);
  vi.stubEnv("FE_EMISOR_TERMINAL", EMISOR.terminal);
  vi.stubEnv("FE_EMISOR_IDENTIFICACION", EMISOR.identificacion);
  vi.resetModules();
  ({ buildFeClave, buildFeNumber, extractConsecutivo } = await import("../../src/lib/fe/xml.js"));
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// Los tres ejemplos están construidos a mano segun la estructura de Hacienda v4.3:
// consecutivo = sucursal(3) + terminal(5) + tipoDoc(2) + numero(10)  -> 20
// clave       = 506(3) + DDMMYY(6) + cedula(12) + consecutivo(20) + situacion(1) + seguridad(8) -> 50
// Las fechas son instantes UTC explícitos al mediodía de Costa Rica (18:00Z). Antes
// se armaban como medianoche local con new Date(a, m, d), «porque buildFeClave usa
// getDate()/getMonth()»: esa era justamente la falla. La clave se calcula ahora en
// hora de Costa Rica, y una medianoche local en una máquina a -03:00 todavía es el
// día anterior acá. Un instante explícito da el mismo resultado en cualquier huso.
const EJEMPLOS = [
  {
    nombre: "factura electrónica común",
    invoiceType: "CUSTOMER_INVOICE",
    consecutivo: 12,
    fecha: new Date("2026-07-15T18:00:00Z"), // 15-jul-2026, 12:00 en CR
    seguridad: "12345678",
    feNumber: "00100001010000000012",
    clave: "506" + "150726" + "003101234567" + "00100001010000000012" + "1" + "12345678",
  },
  {
    nombre: "nota de crédito a cliente",
    invoiceType: "CUSTOMER_CREDIT_NOTE",
    consecutivo: 7,
    fecha: new Date("2026-01-05T18:00:00Z"), // 05-ene-2026, día y mes de un dígito
    seguridad: "00000042",
    feNumber: "00100001030000000007",
    clave: "506" + "050126" + "003101234567" + "00100001030000000007" + "1" + "00000042",
  },
  {
    nombre: "factura de compra (proveedor), consecutivo de 10 dígitos",
    invoiceType: "SUPPLIER_INVOICE",
    consecutivo: 1234567890,
    fecha: new Date("2026-12-31T18:00:00Z"), // 31-dic-2026
    seguridad: "99999999",
    feNumber: "00100001081234567890",
    clave: "506" + "311226" + "003101234567" + "00100001081234567890" + "1" + "99999999",
  },
];

describe("consecutivo FE", () => {
  it.each(EJEMPLOS)("arma el consecutivo de 20 dígitos: $nombre", ({ invoiceType, consecutivo, feNumber }) => {
    const result = buildFeNumber(invoiceType, consecutivo);
    expect(result).toBe(feNumber);
    expect(result).toHaveLength(20);
  });

  it("ubica sucursal, terminal y tipo de documento en su posición", () => {
    const result = buildFeNumber("CUSTOMER_INVOICE", 12);
    expect(result.slice(0, 3)).toBe(EMISOR.sucursal);
    expect(result.slice(3, 8)).toBe(EMISOR.terminal);
    expect(result.slice(8, 10)).toBe("01");
    expect(result.slice(10)).toBe("0000000012");
  });

  it("normaliza consecutivos negativos en vez de romper el largo", () => {
    expect(buildFeNumber("CUSTOMER_INVOICE", -12)).toBe("00100001010000000012");
  });
});

describe("clave numérica FE", () => {
  it.each(EJEMPLOS)("arma la clave de 50 dígitos: $nombre", ({ invoiceType, consecutivo, fecha, seguridad, clave }) => {
    const feNumber = buildFeNumber(invoiceType, consecutivo);
    const result = buildFeClave(feNumber, fecha, seguridad);
    expect(result).toBe(clave);
    expect(result).toHaveLength(50);
    expect(result).toMatch(/^\d{50}$/);
  });

  it("descompone la clave en sus campos oficiales", () => {
    const feNumber = buildFeNumber("CUSTOMER_INVOICE", 12);
    const clave = buildFeClave(feNumber, new Date("2026-07-15T18:00:00Z"), "12345678");
    expect(clave.slice(0, 3)).toBe("506"); // país
    expect(clave.slice(3, 9)).toBe("150726"); // DDMMYY
    expect(clave.slice(9, 21)).toBe("003101234567"); // cédula a 12
    expect(clave.slice(21, 41)).toBe(feNumber); // consecutivo
    expect(clave.slice(41, 42)).toBe("1"); // situación normal
    expect(clave.slice(42)).toBe("12345678"); // código de seguridad
  });

  it("genera un código de seguridad de 8 dígitos cuando no se le pasa uno", () => {
    const feNumber = buildFeNumber("CUSTOMER_INVOICE", 12);
    const clave = buildFeClave(feNumber, new Date("2026-07-15T18:00:00Z"));
    expect(clave).toHaveLength(50);
    expect(clave.slice(42)).toMatch(/^\d{8}$/);
  });

  it("mantiene claves distintas para consecutivos distintos del mismo día", () => {
    const fecha = new Date("2026-07-15T18:00:00Z");
    const a = buildFeClave(buildFeNumber("CUSTOMER_INVOICE", 12), fecha, "12345678");
    const b = buildFeClave(buildFeNumber("CUSTOMER_INVOICE", 13), fecha, "12345678");
    expect(a).not.toBe(b);
  });
});

describe("extractConsecutivo", () => {
  it("toma el último segmento de un número con prefijo", () => {
    expect(extractConsecutivo("FACT/2026/0042")).toBe(42);
    expect(extractConsecutivo("NC-PROV/2026/0007")).toBe(7);
  });

  it("acepta un número plano", () => {
    expect(extractConsecutivo("0123")).toBe(123);
  });

  it("falla ante entradas vacías o no numéricas en vez de asumir 1", () => {
    // Asumir 1 en silencio hacía que Hacienda respondiera "la numeración
    // consecutiva ya existe", un motivo que no apunta a la causa real. El
    // `AUTO-<timestamp>` provisorio de createAutoInvoice caía justo acá.
    for (const entrada of ["", null, undefined, "SIN-NUMERO", "AUTO-1755000000000"]) {
      expect(() => extractConsecutivo(entrada)).toThrow(/no utilizable como consecutivo/);
    }
  });

  it("rechaza el consecutivo cero", () => {
    expect(() => extractConsecutivo("0")).toThrow(/mayor que cero/);
  });
});

describe("la fecha de la clave es la de Costa Rica, no la del servidor", () => {
  // La 0204: emitida a las 21:48 del 19 de octubre hora de Costa Rica, que en UTC
  // ya son las 03:48 del 20. La clave salió con 201026 y FechaEmision con el 19;
  // Hacienda la rechazó con -405 y -16 y el consecutivo quedó quemado.
  it("la 0204 lleva 191026, el día que declara FechaEmision", () => {
    const clave = buildFeClave("00100001010000000204", new Date("2026-10-20T03:48:32.956Z"), "18663597");
    expect(clave.slice(3, 9)).toBe("191026");
  });

  it.each([
    ["17:59:59 en CR, todavía el 19", "2026-10-19T23:59:59Z", "191026"],
    ["18:00 en CR: en UTC ya es el 20", "2026-10-20T00:00:00Z", "191026"],
    ["23:59:59 en CR, último segundo del 19", "2026-10-20T05:59:59Z", "191026"],
    ["00:00 en CR: recién ahí es el 20", "2026-10-20T06:00:00Z", "201026"],
    ["fin de año a las 22:00 en CR", "2027-01-01T04:00:00Z", "311226"],
  ])("%s", (_caso, instante, esperado) => {
    expect(buildFeClave("00100001010000000001", new Date(instante), "00000000").slice(3, 9)).toBe(esperado);
  });

  it("no depende del huso de la máquina que la calcula", async () => {
    // Vercel corre en UTC; las máquinas de desarrollo, en cualquier huso.
    const instante = new Date("2026-10-20T03:48:32Z");
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "America/Costa_Rica", "America/Argentina/Buenos_Aires", "Asia/Tokyo"]) {
        process.env.TZ = tz;
        expect(buildFeClave("00100001010000000204", instante, "1").slice(3, 9)).toBe("191026");
      }
    } finally {
      process.env.TZ = original;
    }
  });
});
