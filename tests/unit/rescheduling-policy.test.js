// tests/unit/rescheduling-policy.test.js
// La regla: se puede mover una cita avisando con 24 horas. Fuera de ese margen
// se cobra el 50%, el paciente queda sin agendar por su cuenta y la
// administración lo contacta. Estos tests fijan los bordes, que es donde se
// discute con un paciente molesto.
import { describe, it, expect } from "vitest";
import {
  evaluarReagenda,
  horasHasta,
  HORAS_MINIMAS_REAGENDA,
  montoMulta,
  saldoDeMulta,
} from "../../src/lib/rescheduling-policy.js";

const AHORA = new Date("2026-08-20T10:00:00Z");
const enHoras = (h) => new Date(AHORA.getTime() + h * 60 * 60 * 1000);

describe("montoMulta()", () => {
  it("es la mitad del valor de la cita", () => {
    expect(montoMulta(40000)).toBe(20000);
    expect(montoMulta(45500)).toBe(22750);
  });

  it("no inventa un cargo si la cita no tiene precio congelado", () => {
    expect(montoMulta(null)).toBe(0);
    expect(montoMulta(0)).toBe(0);
  });

  it("redondea a céntimos, sin arrastrar decimales", () => {
    expect(montoMulta(33333)).toBe(16666.5);
  });
});

describe("evaluarReagenda()", () => {
  it("permite mover con más de 24 horas de aviso", () => {
    const r = evaluarReagenda({ fechaCita: enHoras(48), pricePaid: 40000, ahora: AHORA });
    expect(r.permitido).toBe(true);
  });

  it("rechaza dentro de las 24 horas", () => {
    const r = evaluarReagenda({ fechaCita: enHoras(23), pricePaid: 40000, ahora: AHORA });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("FUERA_DE_PLAZO");
    expect(r.multa).toBe(20000);
  });

  it("el borde exacto de 24 horas todavía permite mover", () => {
    // Es el caso que se discute: quien avisa justo a las 24 horas no paga multa.
    const r = evaluarReagenda({ fechaCita: enHoras(HORAS_MINIMAS_REAGENDA), ahora: AHORA });
    expect(r.permitido).toBe(true);
  });

  it("un minuto después del borde ya no", () => {
    const r = evaluarReagenda({ fechaCita: enHoras(23.99), ahora: AHORA });
    expect(r.permitido).toBe(false);
  });

  it("con la cita ya pasada lo dice sin ambigüedad", () => {
    const r = evaluarReagenda({ fechaCita: enHoras(-2), pricePaid: 40000, ahora: AHORA });
    expect(r.permitido).toBe(false);
    expect(r.mensaje).toMatch(/ya pasó/);
  });

  it("la pausa pesa más que el plazo: ni con dos semanas de aviso", () => {
    // Si el plazo ganara, bastaría con esperar a tener margen para esquivar la
    // conversación que la pausa existe para forzar.
    const r = evaluarReagenda({ fechaCita: enHoras(336), ahora: AHORA, bloqueado: true });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("AGENDAMIENTO_BLOQUEADO");
    expect(r.mensaje).toMatch(/contacto/i);
  });
});

describe("saldoDeMulta()", () => {
  it("en una primera cita el adelanto ya cubre la multa", () => {
    // Adelanto de 20.000 sobre una cita de 40.000: la multa es exactamente eso,
    // así que no corresponde cobrar de nuevo. Cobrar encima sería cobrar el
    // 100% de una consulta que no se dio.
    expect(saldoDeMulta(40000, 20000)).toBe(0);
  });

  it("sin nada pagado se cobra la multa entera", () => {
    expect(saldoDeMulta(40000, 0)).toBe(20000);
  });

  it("descuenta lo parcialmente pagado", () => {
    expect(saldoDeMulta(40000, 5000)).toBe(15000);
  });

  it("nunca devuelve un saldo negativo", () => {
    expect(saldoDeMulta(40000, 40000)).toBe(0);
  });
});

describe("horasHasta()", () => {
  it("cuenta en negativo lo que ya pasó", () => {
    expect(horasHasta(enHoras(-3), AHORA)).toBe(-3);
    expect(horasHasta(enHoras(5), AHORA)).toBe(5);
  });

  it("devuelve null ante una fecha inválida", () => {
    expect(horasHasta("no es fecha", AHORA)).toBeNull();
  });
});
