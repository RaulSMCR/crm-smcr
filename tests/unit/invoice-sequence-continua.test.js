import { beforeEach, describe, expect, it, vi } from "vitest";
import { siguienteNumeroDeFactura } from "@/lib/invoice-sequence";
import { buildFeNumber, extractConsecutivo } from "@/lib/fe/xml.js";

// Una InvoiceSequence de mentira que se comporta como el upsert de Prisma: la
// prueba tiene que ver el `increment` aplicado, no solo el argumento recibido.
function secuenciaFalsa(fila) {
  const estado = { ...fila };
  const upsert = vi.fn(async ({ update, create }) => {
    if (!estado.sequenceType) {
      Object.assign(estado, create);
      return { ...estado };
    }
    if (update.currentNumber?.increment) estado.currentNumber += update.currentNumber.increment;
    // Cualquier otro campo que el código pretenda actualizar se aplica igual,
    // para que la prueba de abajo note si alguien vuelve a escribir `year`.
    for (const [clave, valor] of Object.entries(update)) {
      if (clave !== "currentNumber") estado[clave] = valor;
    }
    return { ...estado };
  });
  return { tx: { invoiceSequence: { upsert } }, estado, upsert };
}

describe("la serie de consecutivos no se reinicia", () => {
  it("cruzar el año no la devuelve a cero: sigue incrementando", async () => {
    // El reinicio anual es la equivocación intuitiva y la que más caro sale:
    // Hacienda exige continuidad por sucursal, terminal y tipo a través de los
    // años, así que volver a 0001 en enero repetiría números ya emitidos y los
    // comprobantes se rechazarían de a uno.
    const { tx } = secuenciaFalsa({ sequenceType: "CUSTOMER_INVOICE", currentNumber: 202, year: 2026, prefix: "", padding: 4 });

    const enDiciembre = await siguienteNumeroDeFactura(tx, "CUSTOMER_INVOICE", new Date("2026-12-31T18:00:00Z"));
    const enEnero = await siguienteNumeroDeFactura(tx, "CUSTOMER_INVOICE", new Date("2027-01-01T18:00:00Z"));

    expect(enDiciembre).toBe("0203");
    expect(enEnero).toBe("0204");
  });

  it("no reescribe `year` al asignar: ese campo no gobierna ningún reinicio", async () => {
    const { tx, estado, upsert } = secuenciaFalsa({ sequenceType: "CUSTOMER_INVOICE", currentNumber: 202, year: 2026, prefix: "", padding: 4 });

    await siguienteNumeroDeFactura(tx, "CUSTOMER_INVOICE", new Date("2027-05-05T18:00:00Z"));

    expect(upsert.mock.calls[0][0].update).toEqual({ currentNumber: { increment: 1 } });
    expect(estado.year).toBe(2026);
  });

  it("una serie que todavía no existe arranca en 1, no en 0", async () => {
    const { tx } = secuenciaFalsa({});
    expect(await siguienteNumeroDeFactura(tx, "CUSTOMER_INVOICE", new Date("2026-10-19T18:00:00Z"))).toBe("0001");
  });
});

describe("el consecutivo que sigue al del sistema anterior", () => {
  // El sistema anterior llegó hasta 00100001010000000202 para esta
  // sucursal/terminal/tipo. La 0189 del CRM duplicaba un número ya usado, así
  // que la serie se reposiciona en 202 y el próximo comprobante tiene que ser
  // exactamente el 203, sin huecos ni repeticiones.
  beforeEach(() => {
    vi.stubEnv("FE_EMISOR_SUCURSAL", "001");
    vi.stubEnv("FE_EMISOR_TERMINAL", "00001");
    vi.resetModules();
  });

  it("con la serie en 202, el siguiente número es 0203", async () => {
    const { tx } = secuenciaFalsa({ sequenceType: "CUSTOMER_INVOICE", currentNumber: 202, year: 2026, prefix: "", padding: 4 });
    expect(await siguienteNumeroDeFactura(tx, "CUSTOMER_INVOICE", new Date("2026-10-19T18:00:00Z"))).toBe("0203");
  });

  it("el 0203 se convierte en el feNumber 00100001010000000203", async () => {
    const { buildFeNumber: build, extractConsecutivo: extract } = await import("@/lib/fe/xml.js");
    expect(extract("0203")).toBe(203);
    expect(build("CUSTOMER_INVOICE", extract("0203"))).toBe("00100001010000000203");
  });

  it("un número provisional no numérico no se puede convertir en consecutivo", () => {
    // Es la salvaguarda de la reemisión: queda en DRAFT como REEMISION-0189, y
    // si alguien intentara emitirla sin validarla esto falla en vez de armar un
    // consecutivo inventado.
    expect(() => extractConsecutivo("REEMISION-0189")).toThrow(/no utilizable como consecutivo/);
    expect(() => buildFeNumber("CUSTOMER_INVOICE", extractConsecutivo(null))).toThrow();
  });
});
