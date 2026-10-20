import { describe, expect, it } from "vitest";
import { parseSupplierInvoiceXml, SupplierXmlError } from "@/lib/supplier-invoice-xml";
import { supplierXml, supplierId, supplierClave, supplierConsecutive } from "../fixtures/supplier-invoice";

const parse = (xml = supplierXml, id = supplierId) => parseSupplierInvoiceXml(xml, id);

describe("extracción de facturas XML del profesional", () => {
  it("extrae los datos fiscales y el detalle sin recalcular los importes", () => {
    expect(parse()).toMatchObject({
      referenceNumber: supplierConsecutive, supplierFeClave: supplierClave, supplierIdNumber: supplierId,
      supplierName: "Profesional de prueba & asociados", invoiceDate: "2026-07-15T23:30:00-06:00",
      currency: "CRC", subtotal: 10000, taxAmount: 400, amount: 10400, supplierEconomicActivity: "869001",
      lines: [{ quantity: 1, taxRate: 4, taxAmount: 400, lineSubtotal: 10000, lineTotal: 10400 }],
    });
  });

  it("acepta namespaces con prefijo, BOM y actividad de v4.3", () => {
    const xml = supplierXml.replace('xmlns="', 'xmlns:fe="').replace(/<(\/?)([A-Z][A-Za-z]*)/g, "<$1fe:$2")
      .replaceAll("CodigoActividadEmisor", "CodigoActividad").replaceAll("v4.4", "v4.3");
    expect(parse(`\uFEFF${xml}`).supplierEconomicActivity).toBe("869001");
  });

  it("conserva descuentos y centavos sin usar un 4% fijo", () => {
    const xml = supplierXml.replace("<SubTotal>10000.00000", "<Descuento><MontoDescuento>1000</MontoDescuento></Descuento><SubTotal>9000.00000")
      .replace("<TotalDescuentos>0", "<TotalDescuentos>1000")
      .replace("<TotalVentaNeta>10000.00000", "<TotalVentaNeta>9000.00000")
      .replace("<Tarifa>4.00", "<Tarifa>13.00").replaceAll(">400.00000", ">1170.00000")
      .replaceAll("10400.00000", "10170.00000");
    expect(parse(xml)).toMatchObject({ subtotal: 9000, discountAmount: 1000, taxAmount: 1170, amount: 10170 });
    expect(parse(xml).lines[0]).toMatchObject({ taxRate: 13, discountPercent: 10 });
    const cents = supplierXml.replaceAll("10000.00000", "10000.01000").replaceAll(">400.00000", ">400.00040").replaceAll("10400.00000", "10400.01040");
    expect(parse(cents).amount).toBe(10400.01);
  });

  it("acepta facturas exentas sin TotalImpuesto ni ImpuestoNeto", () => {
    const xml = supplierXml.replace(/<Impuesto>.*?<\/Impuesto>/s, "").replace(/<ImpuestoNeto>.*?<\/ImpuestoNeto>/s, "")
      .replace(/<TotalImpuesto>.*?<\/TotalImpuesto>/s, "").replaceAll("10400.00000", "10000.00000");
    expect(parse(xml)).toMatchObject({ amount: 10000, taxAmount: 0 });
  });

  it.each([
    ["XML mal formado", supplierXml.replace("</ResumenFactura>", "")],
    ["DTD", '<!DOCTYPE FacturaElectronica [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + supplierXml],
    ["respuesta Hacienda", supplierXml.replaceAll("FacturaElectronica", "MensajeHacienda")],
    ["campo ausente", supplierXml.replace(/<Clave>.*?<\/Clave>/, "")],
    ["campo duplicado", supplierXml.replace("</Clave>", `</Clave><Clave>${supplierClave}</Clave>`)],
    ["emisor distinto", supplierXml.replace(`<Numero>${supplierId}`, "<Numero>399999999")],
    ["consecutivo distinto", supplierXml.replace(`<NumeroConsecutivo>${supplierConsecutive}`, "<NumeroConsecutivo>00100001010000000002")],
    ["fecha inválida", supplierXml.replace("2026-07-15T23:30:00-06:00", "ayer")],
    ["USD", supplierXml.replace("<CodigoMoneda>CRC", "<CodigoMoneda>USD")],
    ["monto inválido", supplierXml.replace("<TotalComprobante>10400.00000", "<TotalComprobante>NaN")],
    ["total distinto", supplierXml.replace("<TotalComprobante>10400.00000", "<TotalComprobante>11400")],
    ["detalle distinto", supplierXml.replace("<SubTotal>10000.00000", "<SubTotal>9999")],
    ["otros cargos", supplierXml.replace("</ResumenFactura>", "<TotalOtrosCargos>100</TotalOtrosCargos></ResumenFactura>")],
    ["archivo grande", " ".repeat(5 * 1024 * 1024) + supplierXml],
  ])("rechaza %s", (_, xml) => {
    expect(() => parse(xml)).toThrow(SupplierXmlError);
  });

  it("rechaza comprobantes de otro profesional y perfiles sin identificación", () => {
    expect(() => parse(supplierXml, "399999999")).toThrow(/no coincide/);
    expect(() => parse(supplierXml, "")).toThrow(/perfil/);
  });
});
