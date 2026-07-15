import { describe, expect, it } from "vitest";
import { NS_MAP, ROOT_ELEMENT_MAP, TIPO_DOC_MAP } from "../../src/lib/fe/config.js";
import { buildFeNumber } from "../../src/lib/fe/xml.js";

describe("catálogo de documentos FE", () => {
  it("mantiene los códigos internos oficiales", () => {
    expect(TIPO_DOC_MAP).toMatchObject({ CUSTOMER_INVOICE: "01", CUSTOMER_CREDIT_NOTE: "03", SUPPLIER_INVOICE: "08", SUPPLIER_CREDIT_NOTE: "03", TIQUETE_ELECTRONICO: "04", NOTA_DEBITO: "02" });
  });
  it("mantiene cada tripleta código, namespace y raíz", () => {
    expect([NS_MAP["01"], ROOT_ELEMENT_MAP["01"]]).toEqual(["https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica", "FacturaElectronica"]);
    expect([NS_MAP["02"], ROOT_ELEMENT_MAP["02"]]).toEqual(["https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/notaDebitoElectronica", "NotaDebitoElectronica"]);
    expect([NS_MAP["03"], ROOT_ELEMENT_MAP["03"]]).toEqual(["https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/notaCreditoElectronica", "NotaCreditoElectronica"]);
    expect([NS_MAP["04"], ROOT_ELEMENT_MAP["04"]]).toEqual(["https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/tiqueteElectronico", "TiqueteElectronico"]);
    expect([NS_MAP["08"], ROOT_ELEMENT_MAP["08"]]).toEqual(["https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronicaCompra", "FacturaElectronicaCompra"]);
    expect([NS_MAP["09"], ROOT_ELEMENT_MAP["09"]]).toEqual(["https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronicaExportacion", "FacturaElectronicaExportacion"]);
  });
  it("embebe el código en el consecutivo", () => {
    expect(buildFeNumber("CUSTOMER_CREDIT_NOTE", 12)).toContain("03");
    expect(buildFeNumber("SUPPLIER_INVOICE", 12)).toContain("08");
  });
});
