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
// Las fechas se construyen como fecha local (new Date(a, m, d)) porque buildFeClave
// usa getDate()/getMonth(), y así el resultado no depende del huso de la máquina.
const EJEMPLOS = [
  {
    nombre: "factura electrónica común",
    invoiceType: "CUSTOMER_INVOICE",
    consecutivo: 12,
    fecha: new Date(2026, 6, 15), // 15-jul-2026
    seguridad: "12345678",
    feNumber: "00100001010000000012",
    clave: "506" + "150726" + "003101234567" + "00100001010000000012" + "1" + "12345678",
  },
  {
    nombre: "nota de crédito a cliente",
    invoiceType: "CUSTOMER_CREDIT_NOTE",
    consecutivo: 7,
    fecha: new Date(2026, 0, 5), // 05-ene-2026, día y mes de un dígito
    seguridad: "00000042",
    feNumber: "00100001030000000007",
    clave: "506" + "050126" + "003101234567" + "00100001030000000007" + "1" + "00000042",
  },
  {
    nombre: "factura de compra (proveedor), consecutivo de 10 dígitos",
    invoiceType: "SUPPLIER_INVOICE",
    consecutivo: 1234567890,
    fecha: new Date(2026, 11, 31), // 31-dic-2026
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
    const clave = buildFeClave(feNumber, new Date(2026, 6, 15), "12345678");
    expect(clave.slice(0, 3)).toBe("506"); // país
    expect(clave.slice(3, 9)).toBe("150726"); // DDMMYY
    expect(clave.slice(9, 21)).toBe("003101234567"); // cédula a 12
    expect(clave.slice(21, 41)).toBe(feNumber); // consecutivo
    expect(clave.slice(41, 42)).toBe("1"); // situación normal
    expect(clave.slice(42)).toBe("12345678"); // código de seguridad
  });

  it("genera un código de seguridad de 8 dígitos cuando no se le pasa uno", () => {
    const feNumber = buildFeNumber("CUSTOMER_INVOICE", 12);
    const clave = buildFeClave(feNumber, new Date(2026, 6, 15));
    expect(clave).toHaveLength(50);
    expect(clave.slice(42)).toMatch(/^\d{8}$/);
  });

  it("mantiene claves distintas para consecutivos distintos del mismo día", () => {
    const fecha = new Date(2026, 6, 15);
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

  it("cae en 1 ante entradas vacías o no numéricas", () => {
    expect(extractConsecutivo("")).toBe(1);
    expect(extractConsecutivo(null)).toBe(1);
    expect(extractConsecutivo("SIN-NUMERO")).toBe(1);
  });
});
