import { describe, expect, it } from "vitest";
import { persistFeDocument } from "@/lib/fe/document";

const documento = (clave) => ({
  feClave: clave,
  feNumber: "123",
  feXml:
    `<FacturaElectronica><Clave>${clave}</Clave><NumeroConsecutivo>123</NumeroConsecutivo>` +
    "<FechaEmision>2026-09-11T12:00:00-06:00</FechaEmision>" +
    "<Emisor><Identificacion><Tipo>02</Tipo><Numero>3000000000</Numero></Identificacion></Emisor>" +
    "</FacturaElectronica>",
});

/**
 * Base mínima en memoria que respeta el único guard que importa acá: el
 * `updateMany` solo escribe si la factura todavía no tiene identidad fiscal.
 */
function baseFalsa(inicial = {}) {
  const fila = { status: "OPEN", feClave: null, feNumber: null, feXml: null, feAmbiente: null, ...inicial };
  return {
    fila,
    invoice: {
      async updateMany({ data }) {
        if (fila.feClave || fila.feNumber || fila.feXml) return { count: 0 };
        Object.assign(fila, data);
        return { count: 1 };
      },
      async findUnique() {
        return { ...fila };
      },
    },
  };
}

describe("ambiente fiscal del comprobante", () => {
  it("se sella junto con la identidad fiscal", async () => {
    const db = baseFalsa();
    const saved = await persistFeDocument(db, "inv-1", documento("clave-produccion"), { ambiente: "01" });
    expect(saved.feAmbiente).toBe("01");
    expect(db.fila.feAmbiente).toBe("01");
  });

  // Las llamadas que no lo pasan siguen funcionando igual que antes: la columna
  // queda en NULL, que es «no se observó», y no en un ambiente inventado.
  it("sin ambiente declarado queda en NULL, no en un valor supuesto", async () => {
    const db = baseFalsa();
    const saved = await persistFeDocument(db, "inv-2", documento("clave-sin-ambiente"));
    expect(saved.feAmbiente).toBeNull();
  });

  // El caso que justifica la columna: un comprobante ya emitido en el sandbox no
  // puede reescribirse como de producción por un envío posterior. Su clave y su
  // consecutivo nacieron en pruebas y así tienen que quedar registrados.
  it("no reescribe el ambiente de un comprobante que ya tiene identidad", async () => {
    // El consecutivo tiene que coincidir con el del XML: `receptionPayload`
    // valida esa correspondencia y rechaza el documento si no cuadra.
    const db = baseFalsa({ ...documento("clave-vieja"), feAmbiente: "02", status: "OPEN" });
    const saved = await persistFeDocument(db, "inv-3", documento("clave-vieja"), { ambiente: "01" });
    expect(saved.feAmbiente).toBe("02");
    expect(saved.feClave).toBe("clave-vieja");
  });
});
