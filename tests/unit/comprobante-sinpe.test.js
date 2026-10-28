import { describe, expect, it } from "vitest";
import { leerComprobanteSinpe, normalizarMonto, sugerirPaciente } from "@/lib/comprobante-sinpe";

// Textos con la forma que devuelve el OCR de capturas de distintos bancos:
// símbolos confundidos, datos en la línea siguiente a su rótulo, tildes perdidas.

describe("normalizarMonto", () => {
  it.each([
    ["40.000,00", 40000], ["40,000.00", 40000], ["40 000", 40000], ["40000", 40000],
    ["38.461,54", 38461.54], ["1,538.46", 1538.46], ["40.000", 40000],
  ])("%s → %d", (token, esperado) => expect(normalizarMonto(token)).toBe(esperado));

  it("rechaza lo que no es un número", () => {
    expect(normalizarMonto("abc")).toBeNull();
    expect(normalizarMonto("")).toBeNull();
  });
});

describe("leerComprobanteSinpe", () => {
  it("formato con rótulo y dato en la misma línea", () => {
    const texto = [
      "Comprobante SINPE Móvil",
      "Destino: 7129-1909",
      "Fecha: 27/10/2026 14:22",
      "Monto: ₡40.000,00",
      "Referencia: 2026102715183012345678",
      "Origen: JAVIER ALEJANDRO AGUILERA AZOFEIFA",
    ].join("\n");
    expect(leerComprobanteSinpe(texto)).toEqual({ monto: 40000, montoAlternativo: null, fecha: "2026-10-27", referencia: "2026102715183012345678" });
  });

  it("formato con el dato en la línea siguiente y CRC en inglés", () => {
    const texto = "Transferencia exitosa\nMonto transferido\nCRC 45,000.00\nFecha\n28 oct 2026\nNúmero de referencia\n8812 3456 7790";
    expect(leerComprobanteSinpe(texto)).toEqual({ monto: 45000, montoAlternativo: null, fecha: "2026-10-28", referencia: "881234567790" });
  });

  it("fecha escrita con el mes en palabras y colón leído como ¢", () => {
    const texto = "SINPE Movil\n¢ 30 000\n15 de setiembre de 2026\nRef. 99887766554";
    expect(leerComprobanteSinpe(texto)).toEqual({ monto: 30000, montoAlternativo: null, fecha: "2026-09-15", referencia: "99887766554" });
  });

  // Texto tal cual lo devolvió tesseract.js 7 con el modelo «spa» sobre una
  // captura de prueba que decía «₡40.000,00»: el ₡ salió como un 2.
  it("el ₡ leído como 2: toma el monto sin el 2 y deja el otro como alternativa", () => {
    const texto = "Transferencia SINPE Móvil exitosa\nMonto\n\n240.000,00\n\nFecha\n\n28/10/2026 14:22\n\nNúmero de referencia\n2026102815183012345678\n\nOrigen\n\nJAVIER ALEJANDRO AGUILERA AZOFEIFA\nDestino\n\n7129-1909\n";
    expect(leerComprobanteSinpe(texto)).toEqual({ monto: 40000, montoAlternativo: 240000, fecha: "2026-10-28", referencia: "2026102815183012345678" });
  });

  it("un monto que empieza con 2 y es plausible no se toca", () => {
    expect(leerComprobanteSinpe("Monto\n25.000,00")).toMatchObject({ monto: 25000, montoAlternativo: null });
  });

  it("con el símbolo de moneda reconocido no se corrige nada", () => {
    expect(leerComprobanteSinpe("Monto: CRC 240,000.00")).toMatchObject({ monto: 240000, montoAlternativo: null });
  });

  it("no toma un teléfono ni un año como monto", () => {
    const texto = "Teléfono 88776655\n2026\nSin monto legible";
    expect(leerComprobanteSinpe(texto).monto).toBeNull();
  });

  it("devuelve null en lo que no encuentra", () => {
    expect(leerComprobanteSinpe("")).toEqual({ monto: null, montoAlternativo: null, fecha: null, referencia: null });
  });

  it("descarta fechas imposibles", () => {
    expect(leerComprobanteSinpe("Fecha: 31/02/2026").fecha).toBeNull();
  });
});

describe("sugerirPaciente", () => {
  const pacientes = [
    { id: "p1", name: "Javier Alejandro Aguilera Azofeifa" },
    { id: "p2", name: "María José Rodríguez Mora" },
    { id: "p3", name: "José Rodríguez Mora" },
  ];

  it("sugiere al que coincide con claridad, sin importar tildes", () => {
    expect(sugerirPaciente("Origen: JAVIER AGUILERA AZOFEIFA", pacientes)).toBe("p1");
  });

  it("no sugiere con una sola palabra en común", () => {
    expect(sugerirPaciente("Origen: JAVIER PEREZ", pacientes)).toBeNull();
  });

  it("no sugiere si dos empatan", () => {
    expect(sugerirPaciente("Origen: JOSE RODRIGUEZ MORA", pacientes)).toBeNull();
  });
});
