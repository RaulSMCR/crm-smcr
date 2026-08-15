import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let generateFeXml;

beforeAll(async () => {
  vi.stubEnv("FE_EMISOR_NOMBRE", "Salud Mental Costa Rica");
  vi.stubEnv("FE_EMISOR_TIPO_ID", "02");
  vi.stubEnv("FE_EMISOR_IDENTIFICACION", "3101234567");
  vi.stubEnv("FE_EMISOR_CORREO", "facturacion@ejemplo.cr");
  vi.stubEnv("FE_EMISOR_TEL_CODIGO", "506");
  vi.stubEnv("FE_EMISOR_TEL_NUMERO", "22222222");
  vi.stubEnv("FE_EMISOR_PROVINCIA", "1");
  vi.stubEnv("FE_EMISOR_CANTON", "01");
  vi.stubEnv("FE_EMISOR_DISTRITO", "01");
  vi.stubEnv("FE_EMISOR_OTRAS_SENAS", "Oficina central");
  vi.stubEnv("FE_EMISOR_ACTIVIDAD", "869093");
  vi.stubEnv("FE_EMISOR_SUCURSAL", "001");
  vi.stubEnv("FE_EMISOR_TERMINAL", "00001");
  vi.resetModules();
  ({ generateFeXml } = await import("../../src/lib/fe/xml.js"));
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const baseInvoice = {
  invoiceNumber: "0012",
  invoiceType: "CUSTOMER_INVOICE",
  invoiceDate: new Date("2026-07-15T16:30:00Z"), // 10:30 en Costa Rica
  paymentMethod: "transferencia",
  currency: "CRC",
  contactName: "Ana Rodríguez",
  contactIdNumber: "1-0234-0567",
  subtotal: 50000,
  taxAmount: 2000,
  discountAmount: 0,
  total: 52000,
};

// Una consulta de 50.000 con IVA de servicios de salud (4%).
const baseLines = [
  { quantity: 1, unitPrice: 50000, discountPercent: 0, taxRate: 4, taxAmount: 2000, product: { name: "Consulta psicológica", cabysCode: "8690900000100" } },
];

const textOf = (xml, tag) => xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];

describe("generateFeXml — estructura", () => {
  it("emite la raíz y el namespace de FacturaElectronica", () => {
    const { xml } = generateFeXml(baseInvoice, baseLines);
    expect(xml).toContain("<FacturaElectronica");
    expect(xml).toContain('xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"');
  });

  it("coloca la clave y el consecutivo derivados del invoiceNumber", () => {
    const { xml, feClave, feNumber } = generateFeXml(baseInvoice, baseLines);
    expect(feNumber).toBe("00100001010000000012");
    expect(feClave).toHaveLength(50);
    expect(textOf(xml, "NumeroConsecutivo")).toBe(feNumber);
    expect(textOf(xml, "Clave")).toBe(feClave);
  });

  it("emite la fecha en hora de Costa Rica, sin importar la zona del servidor", () => {
    // La fecha se declara en UTC a propósito: si el generador usara la hora local
    // del proceso (como hacía antes), este test fallaría en cualquier máquina que
    // no estuviera en Costa Rica, y en Vercel —que corre en UTC— saldrían todas
    // las facturas 6 horas corridas. Hacienda lo rechaza con el error -53.
    const { xml } = generateFeXml(baseInvoice, baseLines);
    expect(textOf(xml, "FechaEmision")).toBe("2026-07-15T10:30:00-06:00");
  });

  it("usa la actividad económica de la factura por encima de la del emisor", () => {
    const { xml } = generateFeXml({ ...baseInvoice, economicActivity: "851203" }, baseLines);
    expect(textOf(xml, "CodigoActividadEmisor")).toBe("85120.3");
    expect(textOf(generateFeXml(baseInvoice, baseLines).xml, "CodigoActividadEmisor")).toBe("86909.3");
  });
});

describe("generateFeXml — receptor", () => {
  it("infiere cédula física de 9 dígitos y limpia los guiones", () => {
    const { xml } = generateFeXml(baseInvoice, baseLines);
    expect(xml).toContain("<Receptor>");
    expect(xml).toMatch(/<Receptor><Nombre>Ana Rodríguez<\/Nombre><Identificacion><Tipo>01<\/Tipo><Numero>102340567<\/Numero>/);
  });

  it("marca cédula jurídica y DIMEX por su largo", () => {
    const juridica = generateFeXml({ ...baseInvoice, contactIdNumber: "3101234567" }, baseLines).xml;
    expect(juridica).toMatch(/<Identificacion><Tipo>02<\/Tipo><Numero>3101234567</);
    const dimex = generateFeXml({ ...baseInvoice, contactIdNumber: "155812345678" }, baseLines).xml;
    expect(dimex).toMatch(/<Identificacion><Tipo>03<\/Tipo><Numero>155812345678</);
  });

  it("omite el receptor cuando no hay nombre", () => {
    const { xml } = generateFeXml({ ...baseInvoice, contactName: "" }, baseLines);
    expect(xml).not.toContain("<Receptor>");
  });

  it("incluye el correo del receptor solo si viene en el contacto", () => {
    const con = generateFeXml({ ...baseInvoice, contact: { email: "ana@ejemplo.cr" } }, baseLines).xml;
    expect(con).toContain("<CorreoElectronico>ana@ejemplo.cr</CorreoElectronico>");
  });
});

describe("generateFeXml — condición de venta y medio de pago", () => {
  it("marca contado cuando no hay vencimiento posterior", () => {
    const { xml } = generateFeXml(baseInvoice, baseLines);
    expect(textOf(xml, "CondicionVenta")).toBe("01");
    expect(xml).not.toContain("<PlazoCredito>");
  });

  it("marca crédito y calcula el plazo en días", () => {
    const dueDate = new Date(2026, 6, 22, 10, 30, 0);
    const { xml } = generateFeXml({ ...baseInvoice, dueDate }, baseLines);
    expect(textOf(xml, "CondicionVenta")).toBe("02");
    expect(textOf(xml, "PlazoCredito")).toBe("7");
  });

  it("traduce el medio de pago y cae en transferencia ante uno desconocido", () => {
    expect(textOf(generateFeXml({ ...baseInvoice, paymentMethod: "efectivo" }, baseLines).xml, "TipoMedioPago")).toBe("01");
    expect(textOf(generateFeXml({ ...baseInvoice, paymentMethod: "tarjeta" }, baseLines).xml, "TipoMedioPago")).toBe("02");
    expect(textOf(generateFeXml({ ...baseInvoice, paymentMethod: "cripto" }, baseLines).xml, "TipoMedioPago")).toBe("04");
  });
});

describe("generateFeXml — líneas e IVA", () => {
  it("mapea la tarifa de IVA de salud (4%) al código 04", () => {
    const { xml } = generateFeXml(baseInvoice, baseLines);
    expect(xml).toContain("<Impuesto><Codigo>01</Codigo><CodigoTarifaIVA>04</CodigoTarifaIVA><Tarifa>4.00</Tarifa><Monto>2000.00</Monto></Impuesto>");
    expect(textOf(xml, "ImpuestoNeto")).toBe("2000.00");
  });

  it("mapea la tarifa general (13%) al código 06", () => {
    const lines = [{ quantity: 1, unitPrice: 10000, taxRate: 13, taxAmount: 1300, product: { name: "Material", cabysCode: "2310100000000" } }];
    const { xml } = generateFeXml({ ...baseInvoice, subtotal: 10000, taxAmount: 1300, total: 11300 }, lines);
    expect(xml).toContain("<CodigoTarifaIVA>06</CodigoTarifaIVA>");
  });

  it("trata la línea sin impuesto como exenta", () => {
    const lines = [{ quantity: 1, unitPrice: 10000, taxRate: 0, taxAmount: 0, product: { name: "Exento", cabysCode: "2310100000000" } }];
    const { xml } = generateFeXml({ ...baseInvoice, subtotal: 10000, taxAmount: 0, total: 10000 }, lines);
    expect(xml).not.toContain("<Impuesto>");
    expect(textOf(xml, "ImpuestoNeto")).toBe("0.00");
    expect(textOf(xml, "TotalServExentos")).toBe("10000.00000");
    // Los totales opcionales en cero se omiten, igual que en el comprobante real
    // aceptado por Hacienda: no se emite TotalServGravados si no hay gravados.
    expect(xml).not.toContain("<TotalServGravados>");
  });

  it("emite el descuento por línea y lo acumula", () => {
    const lines = [{ quantity: 2, unitPrice: 25000, discountPercent: 10, taxRate: 4, taxAmount: 1800, product: { name: "Consulta", cabysCode: "8690900000100" } }];
    const { xml } = generateFeXml({ ...baseInvoice, discountAmount: 5000, subtotal: 50000, taxAmount: 1800, total: 46800 }, lines);
    expect(textOf(xml, "MontoTotal")).toBe("50000.00000");
    expect(textOf(xml, "MontoDescuento")).toBe("5000.00000");
    expect(textOf(xml, "SubTotal")).toBe("45000.00000");
    expect(textOf(xml, "MontoTotalLinea")).toBe("46800.00000");
  });

  it("numera las líneas y usa CABYS y unidad de medida por defecto", () => {
    const lines = [
      { quantity: 1, unitPrice: 1000, taxRate: 4, taxAmount: 40, product: { name: "Uno", cabysCode: "111" } },
      { quantity: 1, unitPrice: 2000, taxRate: 4, taxAmount: 80, description: "Dos", cabysCode: "222" },
    ];
    const { xml } = generateFeXml(baseInvoice, lines);
    expect(xml).toContain("<NumeroLinea>1</NumeroLinea>");
    expect(xml).toContain("<NumeroLinea>2</NumeroLinea>");
    expect(xml).toContain("<CodigoCABYS>111</CodigoCABYS>");
    expect(xml).toContain("<UnidadMedida>Sp</UnidadMedida>");
    expect(xml).toContain("<Detalle>Dos</Detalle>");
  });

  it("aborta si una línea no tiene CABYS, nombrando el servicio", () => {
    // El CABYS es el primer hijo obligatorio de LineaDetalle. Omitirlo produce
    // un XML inválido que Hacienda rechaza señalando el elemento siguiente
    // ("Invalid content ... Cantidad"), lo que despista por completo. Pasó con
    // la factura 0154. Cortar acá evita además gastar un consecutivo.
    const lines = [{ quantity: 1, unitPrice: 1000, taxRate: 4, taxAmount: 40, description: "Psicoterapia" }];
    expect(() => generateFeXml(baseInvoice, lines)).toThrow(/CABYS.*Psicoterapia|Psicoterapia.*CABYS/s);
  });
});

describe("generateFeXml — resumen y notas de crédito", () => {
  it("cuadra el resumen con los totales de la factura", () => {
    const { xml } = generateFeXml(baseInvoice, baseLines);
    expect(textOf(xml, "CodigoMoneda")).toBe("CRC");
    expect(textOf(xml, "TotalVenta")).toBe("50000.00000");
    expect(textOf(xml, "TotalDescuentos")).toBe("0.00000");
    expect(textOf(xml, "TotalVentaNeta")).toBe("50000.00000");
    expect(textOf(xml, "TotalImpuesto")).toBe("2000.00");
    expect(textOf(xml, "TotalComprobante")).toBe("52000.00");
  });

  it("referencia el comprobante anulado en una nota de crédito", () => {
    const invoice = {
      ...baseInvoice,
      invoiceType: "CUSTOMER_CREDIT_NOTE",
      originDocument: "00100001010000000011",
      originInvoice: { invoiceDate: new Date("2026-07-01T15:00:00Z") }, // 09:00 en CR
      notes: "Cita cancelada por el profesional.",
    };
    const { xml } = generateFeXml(invoice, baseLines);
    expect(xml).toContain("<NotaCreditoElectronica");
    expect(xml).toContain("<InformacionReferencia>");
    expect(textOf(xml, "Numero")).toBeTruthy();
    expect(xml).toContain("<Razon>Cita cancelada por el profesional.</Razon>");
  });

  it("omite la referencia cuando la nota no trae documento de origen", () => {
    const { xml } = generateFeXml({ ...baseInvoice, invoiceType: "CUSTOMER_CREDIT_NOTE" }, baseLines);
    expect(xml).not.toContain("<InformacionReferencia>");
  });
});
