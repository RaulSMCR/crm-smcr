// tests/unit/price-ladder.test.js
// Reglas de la escalera de precios. Funciones puras, sin base.
import { describe, it, expect } from "vitest";
import {
  LIMITES_ESCALERA,
  escaleraCompleta,
  escalonVigente,
  precioConEscalera,
  precioPublicoDeTarifa,
  validarEscalones,
} from "@/lib/price-ladder";
import { rangoDePrecios } from "@/lib/service-pricing";

// El ejemplo de Raúl: 10 pacientes nuevos a ₡30.000, 10 a ₡35.000 y 10 a ₡40.000.
function escalera(ocupados = [0, 0, 0]) {
  return {
    tiers: [
      { id: "t1", position: 1, price: 30000, capacity: 10, seatsTaken: ocupados[0] },
      { id: "t2", position: 2, price: 35000, capacity: 10, seatsTaken: ocupados[1] },
      { id: "t3", position: 3, price: 40000, capacity: 10, seatsTaken: ocupados[2] },
    ],
  };
}

const GENERAL = { approvedPrice: 45000, locationId: null, timeBandId: null };
const DOMICILIO = { approvedPrice: 55000, locationId: "loc_dom", timeBandId: null };

describe("validarEscalones()", () => {
  it("numera los escalones en el orden en que se cargan", () => {
    const res = validarEscalones([
      { price: "30000", capacity: "10" },
      { price: 35000, capacity: 10 },
    ]);
    expect(res.escalones).toEqual([
      { position: 1, price: 30000, capacity: 10 },
      { position: 2, price: 35000, capacity: 10 },
    ]);
  });

  it("rechaza precios o cupos inválidos", () => {
    expect(validarEscalones([]).error).toMatch(/al menos un escalón/);
    expect(validarEscalones([{ price: 0, capacity: 10 }]).error).toMatch(/escalón 1.*precio/);
    expect(validarEscalones([{ price: 30000, capacity: 2.5 }]).error).toMatch(/escalón 1.*pacientes/);
    expect(validarEscalones([{ price: 30000, capacity: 10 }, { price: 35000, capacity: 0 }]).error).toMatch(/escalón 2/);
  });

  it("limita la cantidad de escalones", () => {
    const demasiados = Array.from({ length: LIMITES_ESCALERA.escalones + 1 }, () => ({ price: 30000, capacity: 1 }));
    expect(validarEscalones(demasiados).error).toMatch(/hasta/);
  });
});

describe("escalonVigente()", () => {
  it("rige el primer escalón con cupos libres", () => {
    expect(escalonVigente(escalera([10, 3, 0])).id).toBe("t2");
  });

  it("un escalón sobrepasado por pagos tardíos cuenta como lleno", () => {
    expect(escalonVigente(escalera([12, 0, 0])).id).toBe("t2");
  });

  it("sin cupos en ningún escalón, la escalera está completa", () => {
    const llena = escalera([10, 10, 10]);
    expect(escalonVigente(llena)).toBeNull();
    expect(escaleraCompleta(llena)).toBe(true);
    expect(escaleraCompleta(escalera([10, 10, 9]))).toBe(false);
  });

  it("respeta la posición aunque los escalones lleguen desordenados", () => {
    const desordenada = { tiers: [...escalera().tiers].reverse() };
    expect(escalonVigente(desordenada).id).toBe("t1");
  });
});

describe("precioConEscalera()", () => {
  it("un paciente nuevo paga el escalón vigente, que queda registrado", () => {
    expect(precioConEscalera({ rate: GENERAL, escalera: escalera(), esPacienteNuevo: true })).toEqual({
      price: 30000,
      priceTierId: "t1",
      origen: "ESCALON",
    });
  });

  it("quien ya entró conserva su precio aunque la escalera haya subido", () => {
    const res = precioConEscalera({
      rate: GENERAL,
      escalera: escalera([10, 10, 2]),
      inscripcion: { price: 30000 },
      esPacienteNuevo: false,
    });
    expect(res).toEqual({ price: 30000, priceTierId: null, origen: "INSCRIPCION" });
  });

  it("un paciente que ya se atendía antes paga su tarifa normal", () => {
    expect(precioConEscalera({ rate: GENERAL, escalera: escalera(), esPacienteNuevo: false })).toMatchObject({
      price: 45000,
      origen: "TARIFA",
    });
  });

  it("completada la escalera, un paciente nuevo paga la tarifa general", () => {
    expect(precioConEscalera({ rate: GENERAL, escalera: escalera([10, 10, 10]), esPacienteNuevo: true }).price).toBe(45000);
  });

  it("no toca las tarifas por lugar o franja", () => {
    const res = precioConEscalera({
      rate: DOMICILIO,
      escalera: escalera(),
      inscripcion: { price: 30000 },
      esPacienteNuevo: true,
    });
    expect(res).toMatchObject({ price: 55000, origen: "TARIFA", priceTierId: null });
  });
});

describe("precio público", () => {
  it("anuncia el escalón vigente sobre la tarifa general", () => {
    expect(precioPublicoDeTarifa(GENERAL, escalera([10, 0, 0]))).toBe(35000);
  });

  it("rangoDePrecios toma la escalera que viaja con cada tarifa", () => {
    const rates = [
      { ...GENERAL, assignment: { priceLadders: [escalera()] } },
      { ...DOMICILIO, assignment: { priceLadders: [escalera()] } },
    ];
    expect(rangoDePrecios(rates)).toEqual({ min: 30000, max: 55000 });
  });

  it("sin escalera, el rango sigue saliendo del precio aprobado", () => {
    expect(rangoDePrecios([GENERAL])).toEqual({ min: 45000, max: 45000 });
  });
});
