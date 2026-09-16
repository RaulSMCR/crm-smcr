// tests/unit/anticipacion-de-reserva.test.js
//
// Las horas van siempre como instantes absolutos con el desfase tico escrito
// (`-06:00`) y se comparan en ISO: así el resultado no depende del reloj de la
// máquina que corra las pruebas.
import { describe, it, expect } from "vitest";
import {
  AVISO_MINIMO_HORAS,
  motivoDeAnticipacion,
  primerInstanteReservable,
} from "../../src/lib/anticipacion-de-reserva.js";
import { buildSlotDaysCR } from "../../src/lib/appointment-slots.js";

const cr = (texto) => new Date(`${texto}-06:00`);

// 2026-09-14 es lunes.
const LUNES_MANANA = cr("2026-09-14T10:30:00");
const LUNES_NOCHE = cr("2026-09-14T23:50:00");
const LUNES_MADRUGADA = cr("2026-09-14T02:00:00");
const LUNES_TARDE_NOCHE = cr("2026-09-14T21:30:00");

describe("el primer cupo reservable", () => {
  it("de día, es mañana a las nueve", () => {
    // Nada para hoy, aunque queden horas de consulta por delante.
    expect(primerInstanteReservable(LUNES_MANANA).toISOString()).toBe(cr("2026-09-15T09:00:00").toISOString());
  });

  it("de madrugada, sigue siendo mañana a las nueve y no hoy", () => {
    // A las 2 a.m. las 12 horas de aviso caerían hoy a las 14:00; manda la
    // regla del día, que es la que protege el sueño.
    expect(primerInstanteReservable(LUNES_MADRUGADA).toISOString()).toBe(cr("2026-09-15T09:00:00").toISOString());
  });

  it("de noche, manda el aviso mínimo", () => {
    // Es el caso que motivó la regla: reservar a las 11:50 p.m. para las 9 a.m.
    expect(primerInstanteReservable(LUNES_NOCHE).toISOString()).toBe(cr("2026-09-15T11:50:00").toISOString());
  });

  it("en el borde, gana el más tardío de los dos", () => {
    // 21:30 + 12 h = 09:30, media hora más tarde que la hora de corte.
    expect(primerInstanteReservable(LUNES_TARDE_NOCHE).toISOString()).toBe(cr("2026-09-15T09:30:00").toISOString());
  });

  it("el aviso mínimo son doce horas", () => {
    expect(AVISO_MINIMO_HORAS).toBe(12);
  });
});

describe("el motivo cuando es demasiado pronto", () => {
  it("deja pasar el cupo que empieza justo en el piso", () => {
    // «Desde las 9:00» incluye las 9:00, y «12 horas» incluye las 12 justas.
    expect(motivoDeAnticipacion(cr("2026-09-15T09:00:00"), LUNES_MANANA)).toBeNull();
    expect(motivoDeAnticipacion(cr("2026-09-15T11:50:00"), LUNES_NOCHE)).toBeNull();
  });

  it("rechaza hoy, por tarde que sea el cupo", () => {
    expect(motivoDeAnticipacion(cr("2026-09-14T20:00:00"), LUNES_MANANA)).toBeTruthy();
  });

  it("rechaza las primeras horas de mañana", () => {
    expect(motivoDeAnticipacion(cr("2026-09-15T08:00:00"), LUNES_MANANA)).toBeTruthy();
  });

  it("acepta pasado mañana temprano: la hora de corte es solo del día siguiente", () => {
    expect(motivoDeAnticipacion(cr("2026-09-16T07:00:00"), LUNES_MANANA)).toBeNull();
  });

  it("dice desde cuándo sí, no solo que no", () => {
    const motivo = motivoDeAnticipacion(cr("2026-09-15T08:00:00"), LUNES_MANANA);
    expect(motivo).toMatch(/12 horas/);
    expect(motivo).toMatch(/martes/i);
    expect(motivo).toMatch(/09:00|9:00/);
  });

  it("no se traga una fecha inválida", () => {
    expect(motivoDeAnticipacion("cuando sea", LUNES_MANANA)).toBeTruthy();
  });
});

describe("los cupos que se ofrecen", () => {
  const availability = [
    { dayOfWeek: 1, startTime: "08:00", endTime: "12:00" }, // lunes
    { dayOfWeek: 2, startTime: "08:00", endTime: "12:00" }, // martes
  ];

  it("sin piso, ofrece lo que queda de hoy", () => {
    const dias = buildSlotDaysCR({ availability, durationMin: 60, daysAhead: 3, now: LUNES_MANANA });
    expect(dias[0]).toEqual({ date: "2026-09-14", slots: ["11:00"] });
  });

  it("con piso, hoy desaparece y mañana empieza a las nueve", () => {
    const dias = buildSlotDaysCR({
      availability,
      durationMin: 60,
      daysAhead: 3,
      now: LUNES_MANANA,
      noAntesDe: primerInstanteReservable(LUNES_MANANA),
    });
    expect(dias.map((dia) => dia.date)).not.toContain("2026-09-14");
    expect(dias[0]).toEqual({ date: "2026-09-15", slots: ["09:00", "10:00", "11:00"] });
  });

  it("de noche, el aviso mínimo corre también los cupos de mañana", () => {
    const dias = buildSlotDaysCR({
      availability,
      durationMin: 60,
      daysAhead: 3,
      now: LUNES_NOCHE,
      noAntesDe: primerInstanteReservable(LUNES_NOCHE),
    });
    // El piso cae a las 11:50, así que de la mañana del martes no queda nada.
    expect(dias.find((dia) => dia.date === "2026-09-15")).toBeUndefined();
  });
});
