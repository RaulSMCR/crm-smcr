// tests/unit/fiscal-environment.test.js
//
// La URL de ONVO es idéntica en pruebas y en vivo: solo el prefijo de la llave
// dice en cuál se está. Sin esta comprobación, una llave `live` en un deploy de
// pruebas cobra dinero real sin que nada lo delate.
import { describe, it, expect } from "vitest";
import {
  detectarAmbienteOnvo,
  detectarAmbienteFe,
  assertAmbientesCoherentes,
} from "../../src/lib/fiscal-environment.js";

const LLAVE_PRUEBAS = "onvo_test_secret_key_abc123";
const LLAVE_VIVO = "onvo_live_secret_key_abc123";

describe("detectarAmbienteOnvo()", () => {
  it("distingue la llave de pruebas de la de producción", () => {
    expect(detectarAmbienteOnvo(LLAVE_PRUEBAS)).toBe("pruebas");
    expect(detectarAmbienteOnvo(LLAVE_VIVO)).toBe("produccion");
  });

  it("no opina ante una llave irreconocible", () => {
    for (const llave of ["", null, undefined, "sk_live_de_otra_pasarela"]) {
      expect(detectarAmbienteOnvo(llave)).toBeNull();
    }
  });
});

describe("detectarAmbienteFe()", () => {
  it("traduce los códigos de Hacienda", () => {
    expect(detectarAmbienteFe("01")).toBe("produccion");
    expect(detectarAmbienteFe("02")).toBe("pruebas");
  });

  it("no opina ante un código desconocido", () => {
    for (const codigo of ["", null, "03", "1"]) {
      expect(detectarAmbienteFe(codigo)).toBeNull();
    }
  });
});

describe("assertAmbientesCoherentes()", () => {
  it("acepta ambos en pruebas", () => {
    const r = assertAmbientesCoherentes({ onvoKey: LLAVE_PRUEBAS, feAmbiente: "02" });
    expect(r).toMatchObject({ ok: true, ambiente: "pruebas" });
  });

  it("acepta ambos en producción", () => {
    const r = assertAmbientesCoherentes({ onvoKey: LLAVE_VIVO, feAmbiente: "01" });
    expect(r).toMatchObject({ ok: true, ambiente: "produccion" });
  });

  it("aborta si se cobra de verdad y se factura en pruebas", () => {
    // El caso más caro: el paciente paga y su comprobante no vale ante Hacienda.
    expect(() => assertAmbientesCoherentes({ onvoKey: LLAVE_VIVO, feAmbiente: "02" })).toThrow(
      /no tendría validez tributaria/
    );
  });

  it("aborta si se factura de verdad y se cobra en pruebas", () => {
    expect(() => assertAmbientesCoherentes({ onvoKey: LLAVE_PRUEBAS, feAmbiente: "01" })).toThrow(
      /cobros que no ocurrieron/
    );
  });

  it("el mensaje nombra las dos variables a revisar", () => {
    expect(() => assertAmbientesCoherentes({ onvoKey: LLAVE_VIVO, feAmbiente: "02" })).toThrow(
      /ONVO_SECRET_KEY.*FE_AMBIENTE/s
    );
  });

  it("permite la mezcla solo si se declara explícitamente", () => {
    const r = assertAmbientesCoherentes({
      onvoKey: LLAVE_VIVO,
      feAmbiente: "02",
      permitirMixto: true,
    });
    expect(r).toMatchObject({ ok: true, mixto: true });
  });

  it("aborta si ONVO está en producción y falta FE_AMBIENTE", () => {
    // Pasó en producción: FE_AMBIENTE no existía en Vercel y el candado quedaba
    // desactivado en silencio. Con una llave `live` eso sería cobrar sin poder
    // facturar.
    expect(() => assertAmbientesCoherentes({ onvoKey: LLAVE_VIVO, feAmbiente: "" })).toThrow(
      /FE_AMBIENTE no está configurada/
    );
  });

  it("no opina si falta alguno de los dos datos", () => {
    // De los faltantes ya se encargan assertFeConfig() y createPaymentLink().
    expect(assertAmbientesCoherentes({ onvoKey: "", feAmbiente: "01" }).motivo).toBe("indeterminado");
    expect(assertAmbientesCoherentes({ onvoKey: LLAVE_PRUEBAS, feAmbiente: "" }).motivo).toBe("indeterminado");
  });
});
