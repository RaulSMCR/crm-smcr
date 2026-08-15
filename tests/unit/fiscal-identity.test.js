// tests/unit/fiscal-identity.test.js
// Quien pide factura deducible suele ser una empresa, y ahí es justo donde
// adivinar el tipo por el largo se equivoca: cédula jurídica y NITE tienen los
// mismos 10 dígitos. Estos tests fijan que el tipo declarado mande.
import { describe, it, expect } from "vitest";
import {
  datosFacturacionDe,
  inferirTipoIdentificacion,
  limpiarIdentificacion,
  validarIdentificacionFiscal,
} from "../../src/lib/fiscal-identity.js";

describe("limpiarIdentificacion()", () => {
  it("quita guiones y espacios, que Hacienda no acepta", () => {
    expect(limpiarIdentificacion("1-1204-1024")).toBe("112041024");
    expect(limpiarIdentificacion(" 3 101 885661 ")).toBe("3101885661");
    expect(limpiarIdentificacion(null)).toBe("");
  });
});

describe("validarIdentificacionFiscal()", () => {
  it("acepta los cuatro tipos con su largo correcto", () => {
    expect(validarIdentificacionFiscal("01", "112041024").ok).toBe(true);
    expect(validarIdentificacionFiscal("02", "3101885661").ok).toBe(true);
    expect(validarIdentificacionFiscal("03", "155812345678").ok).toBe(true);
    expect(validarIdentificacionFiscal("04", "1234567890").ok).toBe(true);
  });

  it("rechaza una jurídica que no empiece con 3", () => {
    const r = validarIdentificacionFiscal("02", "1101885661");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/empiezan con 3/);
  });

  it("rechaza una física que no tenga 9 dígitos", () => {
    expect(validarIdentificacionFiscal("01", "11204102").ok).toBe(false);
    expect(validarIdentificacionFiscal("01", "1120410245").ok).toBe(false);
  });

  it("exige declarar el tipo en vez de suponerlo", () => {
    const r = validarIdentificacionFiscal("", "3101885661");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/tipo de identificación/i);
  });

  it("devuelve el número ya limpio para guardarlo", () => {
    expect(validarIdentificacionFiscal("02", "3-101-885661").numero).toBe("3101885661");
  });
});

describe("inferirTipoIdentificacion()", () => {
  it("acierta con la cédula física, que es el caso corriente", () => {
    expect(inferirTipoIdentificacion("112041024")).toBe("01");
  });

  it("confunde NITE con jurídica: por eso el tipo se declara", () => {
    // Ambos tienen 10 dígitos. La inferencia solo mira el largo y el prefijo,
    // así que un NITE que empiece con 3 se leería como cédula jurídica.
    expect(inferirTipoIdentificacion("3101885661")).toBe("02");
    expect(inferirTipoIdentificacion("3000000001")).toBe("02"); // podría ser NITE
  });
});

describe("datosFacturacionDe()", () => {
  const paciente = {
    name: "Ana Rojas",
    email: "ana@example.com",
    identification: "112041024",
  };

  it("usa la identidad de la cuenta cuando no hay datos de facturación", () => {
    const r = datosFacturacionDe(paciente);
    expect(r).toMatchObject({
      nombre: "Ana Rojas",
      identificacion: "112041024",
      tipoIdentificacion: "01",
      correo: "ana@example.com",
      esDeTercero: false,
    });
  });

  it("factura a la empresa cuando el paciente la cargó", () => {
    const r = datosFacturacionDe({
      ...paciente,
      billingName: "Consultora Delta S.A.",
      billingIdType: "02",
      billingIdNumber: "3101885661",
      billingEmail: "contabilidad@delta.cr",
    });
    expect(r).toMatchObject({
      nombre: "Consultora Delta S.A.",
      identificacion: "3101885661",
      tipoIdentificacion: "02",
      correo: "contabilidad@delta.cr",
      esDeTercero: true,
    });
  });

  it("respeta el tipo declarado aunque la inferencia diría otra cosa", () => {
    // 10 dígitos empezando con 3: la inferencia diría jurídica.
    const r = datosFacturacionDe({
      ...paciente,
      billingName: "Fideicomiso X",
      billingIdType: "04",
      billingIdNumber: "3000000001",
    });
    expect(r.tipoIdentificacion).toBe("04");
  });

  it("cae al correo de la cuenta si no se indicó uno para la factura", () => {
    const r = datosFacturacionDe({
      ...paciente,
      billingName: "Consultora Delta S.A.",
      billingIdType: "02",
      billingIdNumber: "3101885661",
    });
    expect(r.correo).toBe("ana@example.com");
  });

  it("ignora datos de facturación a medias", () => {
    // Un nombre de empresa con la cédula personal produce un comprobante que no
    // sirve para deducir y que Hacienda aceptaría igual. Se exige la pareja.
    const soloNombre = datosFacturacionDe({ ...paciente, billingName: "Consultora Delta S.A." });
    expect(soloNombre.esDeTercero).toBe(false);
    expect(soloNombre.nombre).toBe("Ana Rojas");

    const soloCedula = datosFacturacionDe({ ...paciente, billingIdNumber: "3101885661" });
    expect(soloCedula.esDeTercero).toBe(false);
    expect(soloCedula.identificacion).toBe("112041024");
  });
});
