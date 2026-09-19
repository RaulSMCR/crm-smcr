// tests/unit/fiscal-identity-extranjero.test.js
//
// Un NITE lo asigna Hacienda. No se deduce y no se inventa.
//
// La inferencia por largo terminaba en `return NITE` para todo lo que no calzara
// con los tres formatos costarricenses. El 2026-09-18 eso declaró como NITE el
// DNI de 8 dígitos de una paciente extranjera: un número que no existe en el
// registro de Tributación, en un comprobante real. La 4.4 tiene un tipo para ese
// caso —05, extranjero no domiciliado— y es el que corresponde.
import { describe, it, expect } from "vitest";
import {
  MAX_LARGO_IDENTIFICACION,
  TIPOS_IDENTIFICACION,
  datosFacturacionDe,
  inferirTipoIdentificacion,
  normalizarIdentificacion,
  validarIdentificacionFiscal,
} from "@/lib/fiscal-identity";

describe("inferirTipoIdentificacion — no inventa un NITE", () => {
  it("un DNI extranjero de 8 dígitos no se declara como NITE", () => {
    expect(inferirTipoIdentificacion("95930281")).toBeNull();
  });

  it("tampoco lo hace con largos raros", () => {
    for (const valor of ["1", "1234567", "1234567890123456"]) {
      expect(inferirTipoIdentificacion(valor)).toBeNull();
    }
  });

  it("un NITE de verdad sigue sin poder deducirse: comparte largo con la jurídica", () => {
    // 10 dígitos que no empiezan en 3 ya no se adivinan. El tipo lo declara la
    // persona; acá lo que importa es que no se afirme nada falso.
    expect(inferirTipoIdentificacion("1234567890")).toBeNull();
  });

  it("los formatos costarricenses inequívocos se siguen deduciendo", () => {
    expect(inferirTipoIdentificacion("112345678")).toBe(TIPOS_IDENTIFICACION.FISICA);
    expect(inferirTipoIdentificacion("3101885661")).toBe(TIPOS_IDENTIFICACION.JURIDICA);
    expect(inferirTipoIdentificacion("155812345678")).toBe(TIPOS_IDENTIFICACION.DIMEX);
  });
});

describe("extranjero no domiciliado (05)", () => {
  it("acepta un documento con letras, que es lo que un pasaporte trae", () => {
    const res = validarIdentificacionFiscal(TIPOS_IDENTIFICACION.EXTRANJERO, "ab-123 456");
    expect(res).toEqual({ ok: true, numero: "AB123456" });
  });

  it("acepta el DNI de la paciente que motivó esto", () => {
    expect(validarIdentificacionFiscal(TIPOS_IDENTIFICACION.EXTRANJERO, "95930281")).toEqual({
      ok: true, numero: "95930281",
    });
  });

  it("rechaza lo que no entra en el campo de la 4.4", () => {
    const largo = "A".repeat(MAX_LARGO_IDENTIFICACION + 1);
    expect(validarIdentificacionFiscal(TIPOS_IDENTIFICACION.EXTRANJERO, largo).ok).toBe(false);
  });

  it("no le borra las letras al normalizar, a diferencia de los tipos locales", () => {
    expect(normalizarIdentificacion("05", "AB123456")).toBe("AB123456");
    expect(normalizarIdentificacion("01", "1-1234-5678")).toBe("112345678");
  });

  it("el número declarado llega intacto al receptor de la factura", () => {
    const receptor = datosFacturacionDe({
      name: "Carolina", email: "c@example.com",
      billingName: "Carolina", billingIdType: "05", billingIdNumber: "AB123456",
    });
    expect(receptor.tipoIdentificacion).toBe("05");
    expect(receptor.identificacion).toBe("AB123456");
  });
});

describe("sin tipo reconocible, el receptor va sin identificación", () => {
  it("no arrastra un tipo inventado", () => {
    const receptor = datosFacturacionDe({
      name: "Carolina", email: "c@example.com", identification: "95930281",
    });
    expect(receptor.nombre).toBe("Carolina");
    expect(receptor.tipoIdentificacion).toBeNull();
  });
});
