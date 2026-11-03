import { describe, expect, it } from "vitest";
import { agruparPorDia, semanaDesde } from "@/lib/pro/agenda-semana";
import { DIAS_HACIA_ADELANTE } from "@/lib/appointment-slots";

// Lunes 2 de noviembre de 2026, 6:30 p. m. en Costa Rica (ya es martes en UTC).
const ahora = new Date("2026-11-03T00:30:00Z");

describe("semanaDesde", () => {
  it("sin parámetro arranca hoy, en hora tica, y no deja ir hacia atrás", () => {
    const semana = semanaDesde(undefined, ahora);
    expect(semana.desde).toBe("2026-11-02");
    expect(semana.dias).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
    ]);
    expect(semana.anterior).toBeNull();
    expect(semana.siguiente).toBe("2026-11-09");
    expect(semana.inicio.toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(semana.fin.toISOString()).toBe("2026-11-09T06:00:00.000Z");
  });

  it("ignora fechas inválidas o pasadas", () => {
    expect(semanaDesde("cualquier-cosa", ahora).desde).toBe("2026-11-02");
    expect(semanaDesde("2026-10-01", ahora).desde).toBe("2026-11-02");
  });

  it("al volver de una semana cercana no se pasa de hoy", () => {
    expect(semanaDesde("2026-11-05", ahora).anterior).toBe("2026-11-02");
  });

  it("no deja avanzar más allá de la ventana en que se conocen bloqueos y Google", () => {
    const lejos = semanaDesde("2030-01-01", ahora);
    expect(lejos.siguiente).toBeNull();
    expect(lejos.dias).toHaveLength(7);
    // El último día visible es el último de la ventana.
    const ultimo = new Date(`${lejos.dias.at(-1)}T12:00:00-06:00`).getTime();
    const tope = new Date("2026-11-02T12:00:00-06:00").getTime() + (DIAS_HACIA_ADELANTE - 1) * 86400000;
    expect(ultimo).toBe(tope);
  });
});

describe("agruparPorDia", () => {
  it("pone cada cita en su día tico y deja los días libres vacíos", () => {
    const dias = semanaDesde(undefined, ahora).dias;
    const grupos = agruparPorDia(
      [
        // 7:00 p. m. del lunes en Costa Rica = 01:00 del martes en UTC.
        { id: "lunes-noche", date: new Date("2026-11-03T01:00:00Z") },
        { id: "miercoles", date: new Date("2026-11-04T22:00:00Z") },
      ],
      dias
    );
    expect(grupos[0]).toEqual({ dia: "2026-11-02", citas: [{ id: "lunes-noche", date: new Date("2026-11-03T01:00:00Z") }] });
    expect(grupos[1].citas).toEqual([]);
    expect(grupos[2].citas.map((c) => c.id)).toEqual(["miercoles"]);
  });
});
