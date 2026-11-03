import { describe, expect, it } from "vitest";
import { PROXIMAS_A_MOSTRAR, repartirAgendaDeHoy, ventanaDeHoy } from "@/lib/pro/agenda-hoy";

// Lunes 2 de noviembre de 2026, 6:30 p. m. en Costa Rica.
const ahora = new Date("2026-11-03T00:30:00Z");
const cr = (fechaHora) => new Date(`${fechaHora}-06:00`);

const cita = (id, fechaHora, status = "CONFIRMED") => ({ id, date: cr(fechaHora), status });

describe("ventanaDeHoy", () => {
  it("usa el día de Costa Rica, aunque en UTC ya sea mañana", () => {
    const { hoy, inicioDeManana } = ventanaDeHoy(ahora);
    expect(hoy).toBe("2026-11-02");
    expect(inicioDeManana.toISOString()).toBe(cr("2026-11-03T00:00:00").toISOString());
  });
});

describe("repartirAgendaDeHoy", () => {
  it("pone primero las confirmadas que ya empezaron y nadie cerró, aunque sean de otro día", () => {
    const { porCerrar, hoy, proximas } = repartirAgendaDeHoy(
      [
        cita("en-curso", "2026-11-02T18:00:00"),
        cita("de-ayer", "2026-11-01T16:00:00"),
        cita("esta-noche", "2026-11-02T19:00:00"),
        cita("manana", "2026-11-03T09:00:00"),
      ],
      ahora
    );
    expect(porCerrar.map((c) => c.id)).toEqual(["de-ayer", "en-curso"]);
    expect(hoy.map((c) => c.id)).toEqual(["esta-noche"]);
    expect(proximas.map((c) => c.id)).toEqual(["manana"]);
  });

  it("muestra las solicitudes pendientes de hoy, pero no las que ya pasaron", () => {
    const { porCerrar, hoy } = repartirAgendaDeHoy(
      [cita("pendiente-pasada", "2026-11-02T10:00:00", "PENDING"), cita("pendiente-noche", "2026-11-02T20:00:00", "PENDING")],
      ahora
    );
    expect(porCerrar).toEqual([]);
    expect(hoy.map((c) => c.id)).toEqual(["pendiente-noche"]);
  });

  it("limita las próximas a un vistazo", () => {
    const muchas = Array.from({ length: 9 }, (_, i) => cita(`dia-${i}`, `2026-11-${String(4 + i).padStart(2, "0")}T10:00:00`));
    expect(repartirAgendaDeHoy(muchas, ahora).proximas).toHaveLength(PROXIMAS_A_MOSTRAR);
  });
});
