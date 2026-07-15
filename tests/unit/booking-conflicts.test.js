import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { appointment: { findMany: (...args) => findMany(...args) } } }));

const {
  buildOccurrenceEnds,
  buildOverlapWhere,
  buildOverlapWindow,
  CANCELLED_APPOINTMENT_STATUSES,
  findConflictInOccurrences,
  findRecurringConflict,
} = await import("@/lib/booking-conflicts");

const at = (day, hour) => new Date(2026, 6, day, hour, 0, 0);

beforeEach(() => {
  findMany.mockReset();
});

describe("buildOccurrenceEnds", () => {
  it("suma la duración a cada ocurrencia", () => {
    const ends = buildOccurrenceEnds([at(6, 9), at(13, 9)], 50);
    expect(ends).toEqual([new Date(2026, 6, 6, 9, 50), new Date(2026, 6, 13, 9, 50)]);
  });

  it("no altera el arreglo de inicios", () => {
    const starts = [at(6, 9)];
    buildOccurrenceEnds(starts, 50);
    expect(starts[0]).toEqual(at(6, 9));
  });
});

describe("findConflictInOccurrences", () => {
  it("detecta traslape parcial y devuelve la primera ocurrencia afectada", () => {
    const starts = [at(6, 9), at(13, 9)];
    const ends = buildOccurrenceEnds(starts, 60);
    // Cita existente 13-jul 09:30–10:30: traslapa la segunda ocurrencia.
    const existing = [{ date: new Date(2026, 6, 13, 9, 30), endDate: new Date(2026, 6, 13, 10, 30) }];

    expect(findConflictInOccurrences(existing, starts, ends)).toEqual({ index: 1, start: at(13, 9) });
  });

  it("no marca conflicto cuando las citas solo se tocan en el borde", () => {
    const starts = [at(6, 9)];
    const ends = buildOccurrenceEnds(starts, 60); // 09:00–10:00
    const pegadaAntes = [{ date: at(6, 8), endDate: at(6, 9) }]; // termina justo al iniciar
    const pegadaDespues = [{ date: at(6, 10), endDate: at(6, 11) }]; // inicia justo al terminar

    expect(findConflictInOccurrences(pegadaAntes, starts, ends)).toBeNull();
    expect(findConflictInOccurrences(pegadaDespues, starts, ends)).toBeNull();
  });

  it("detecta la cita existente que envuelve por completo a la nueva", () => {
    const starts = [at(6, 9)];
    const ends = buildOccurrenceEnds(starts, 60);
    const envolvente = [{ date: at(6, 8), endDate: at(6, 12) }];
    expect(findConflictInOccurrences(envolvente, starts, ends)).toEqual({ index: 0, start: at(6, 9) });
  });

  it("devuelve null sin ocurrencias o sin citas existentes", () => {
    expect(findConflictInOccurrences([], [at(6, 9)], [at(6, 10)])).toBeNull();
    expect(findConflictInOccurrences([{ date: at(6, 9), endDate: at(6, 10) }], [], [])).toBeNull();
  });
});

describe("buildOverlapWindow", () => {
  it("cubre toda la serie sin depender del orden de las ocurrencias", () => {
    const starts = [at(20, 9), at(6, 9), at(13, 9)];
    const ends = buildOccurrenceEnds(starts, 60);
    expect(buildOverlapWindow(starts, ends)).toEqual({
      minStart: at(6, 9),
      maxEnd: new Date(2026, 6, 20, 10, 0),
    });
  });
});

describe("buildOverlapWhere", () => {
  it("excluye las citas canceladas", () => {
    const where = buildOverlapWhere({ professionalId: "p1", minStart: at(6, 9), maxEnd: at(6, 10) });
    expect(where.status).toEqual({ notIn: CANCELLED_APPOINTMENT_STATUSES });
    expect(CANCELLED_APPOINTMENT_STATUSES).toEqual(["CANCELLED_BY_USER", "CANCELLED_BY_PRO"]);
  });

  it("omite la cita que se está reprogramando solo cuando se pide", () => {
    const base = { professionalId: "p1", minStart: at(6, 9), maxEnd: at(6, 10) };
    expect(buildOverlapWhere({ ...base, ignoreAppointmentId: "a1" }).id).toEqual({ not: "a1" });
    expect(buildOverlapWhere(base).id).toBeUndefined();
  });
});

describe("findRecurringConflict", () => {
  it("consulta una sola vez con la ventana de toda la serie", async () => {
    findMany.mockResolvedValue([]);
    const starts = [at(6, 9), at(13, 9), at(20, 9)];
    const ends = buildOccurrenceEnds(starts, 60);

    const result = await findRecurringConflict({ professionalId: "p1", starts, ends });

    expect(result).toBeNull();
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      professionalId: "p1",
      date: { lt: new Date(2026, 6, 20, 10, 0) },
      endDate: { gt: at(6, 9) },
    });
  });

  it("devuelve la ocurrencia traslapada de una serie recurrente", async () => {
    findMany.mockResolvedValue([{ date: new Date(2026, 6, 13, 9, 30), endDate: new Date(2026, 6, 13, 10, 30) }]);
    const starts = [at(6, 9), at(13, 9), at(20, 9)];
    const ends = buildOccurrenceEnds(starts, 60);

    expect(await findRecurringConflict({ professionalId: "p1", starts, ends })).toEqual({ index: 1, start: at(13, 9) });
  });

  it("no consulta la base cuando la serie viene vacía", async () => {
    expect(await findRecurringConflict({ professionalId: "p1", starts: [], ends: [] })).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("propaga ignoreAppointmentId al filtro", async () => {
    findMany.mockResolvedValue([]);
    const starts = [at(6, 9)];
    await findRecurringConflict({ professionalId: "p1", starts, ends: buildOccurrenceEnds(starts, 60), ignoreAppointmentId: "a1" });
    expect(findMany.mock.calls[0][0].where.id).toEqual({ not: "a1" });
  });
});
