// tests/unit/calendario-pacientes.test.js
// Qué series de Google se pueden adoptar como acuerdo y cómo se cruzan los
// invitados con los pacientes registrados. Google y Prisma están simulados.
import { beforeEach, describe, expect, it, vi } from "vitest";

const calendar = { events: { list: vi.fn(), get: vi.fn(), instances: vi.fn() } };
vi.mock("@/lib/google", () => ({ getCalendarClient: () => calendar }));

const {
  correosInvitados,
  eventosPorCorreo,
  pacientesEnElCalendario,
  periodicidadDeRegla,
  verificarSerieParaAcuerdo,
} = await import("@/lib/calendario-pacientes");

const prisma = {
  professionalProfile: {
    findUnique: vi.fn(async () => ({ id: "pro-raul", googleRefreshToken: "rt", googleCalendarId: null })),
  },
  user: { findMany: vi.fn() },
};

const SERIE = {
  id: "serie-ciani",
  status: "confirmed",
  summary: "Ciani",
  recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=TU"],
  organizer: { self: true },
  attendees: [{ email: "raul@example.com", self: true }, { email: "Ciani@Example.com" }],
  start: { dateTime: "2026-09-01T17:00:00-06:00" },
};

beforeEach(() => vi.clearAllMocks());

describe("periodicidadDeRegla()", () => {
  it("reconoce semanal, quincenal y mensual por día del mes", () => {
    expect(periodicidadDeRegla(["RRULE:FREQ=WEEKLY;BYDAY=TU"])).toBe("WEEKLY");
    expect(periodicidadDeRegla(["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"])).toBe("BIWEEKLY");
    expect(periodicidadDeRegla(["RRULE:FREQ=MONTHLY"])).toBe("MONTHLY");
  });

  it("rechaza lo que el acuerdo no puede reproducir sesión por sesión", () => {
    expect(periodicidadDeRegla(["RRULE:FREQ=WEEKLY;COUNT=10"])).toBeNull();
    expect(periodicidadDeRegla(["RRULE:FREQ=WEEKLY;UNTIL=20261231T000000Z"])).toBeNull();
    expect(periodicidadDeRegla(["RRULE:FREQ=WEEKLY;BYDAY=TU,TH"])).toBeNull();
    expect(periodicidadDeRegla(["RRULE:FREQ=MONTHLY;BYDAY=2TU"])).toBeNull();
    expect(periodicidadDeRegla(["RRULE:FREQ=WEEKLY;INTERVAL=3"])).toBeNull();
    expect(periodicidadDeRegla(["RRULE:FREQ=DAILY"])).toBeNull();
    expect(periodicidadDeRegla([])).toBeNull();
  });
});

describe("cruce de invitados", () => {
  it("ignora al dueño del calendario y normaliza el correo", () => {
    expect(correosInvitados(SERIE)).toEqual(["ciani@example.com"]);
  });

  it("descarta excepciones de una serie y eventos cancelados", () => {
    const mapa = eventosPorCorreo([
      SERIE,
      { ...SERIE, id: "serie-ciani_20261006", recurringEventId: "serie-ciani", recurrence: undefined },
      { ...SERIE, id: "cancelado", status: "cancelled" },
    ]);
    expect(mapa.get("ciani@example.com").map((e) => e.id)).toEqual(["serie-ciani"]);
    expect(mapa.get("ciani@example.com")[0]).toMatchObject({ recurrente: true, periodicidad: "WEEKLY", propio: true });
  });

  it("devuelve solo invitados que son pacientes registrados", async () => {
    calendar.events.list.mockResolvedValueOnce({ data: { items: [SERIE] } });
    prisma.user.findMany.mockResolvedValueOnce([{ id: "pac-ciani", name: "Ciani Vega", email: "ciani@example.com" }]);

    const r = await pacientesEnElCalendario(prisma, "pro-raul");

    expect(prisma.user.findMany.mock.calls[0][0].where.email.in).toEqual(["ciani@example.com"]);
    expect(r).toEqual([
      expect.objectContaining({ patientId: "pac-ciani", eventos: [expect.objectContaining({ id: "serie-ciani" })] }),
    ]);
  });

  it("sin Google conectado devuelve null, no una lista vacía", async () => {
    prisma.professionalProfile.findUnique.mockResolvedValueOnce({ id: "pro-x", googleRefreshToken: null });
    expect(await pacientesEnElCalendario(prisma, "pro-x")).toBeNull();
  });
});

describe("verificarSerieParaAcuerdo()", () => {
  const PEDIDO = {
    professionalId: "pro-raul",
    serieId: "serie-ciani",
    periodicidad: "WEEKLY",
    inicio: "2026-10-27T23:00:00Z",
    patientEmail: "ciani@example.com",
  };

  it("la adopta si la primera sesión es una instancia real de la serie", async () => {
    calendar.events.get.mockResolvedValueOnce({ data: { ...SERIE, hangoutLink: "https://meet.google.com/x" } });
    calendar.events.instances.mockResolvedValueOnce({
      data: { items: [{ originalStartTime: { dateTime: "2026-10-27T17:00:00-06:00" } }] },
    });

    expect(await verificarSerieParaAcuerdo(prisma, PEDIDO)).toEqual({
      ok: true,
      gcalEventId: "serie-ciani",
      meetLink: "https://meet.google.com/x",
    });
  });

  it("no la adopta si la hora no cae en una sesión de la serie", async () => {
    calendar.events.get.mockResolvedValueOnce({ data: SERIE });
    calendar.events.instances.mockResolvedValueOnce({
      data: { items: [{ originalStartTime: { dateTime: "2026-10-27T18:00:00-06:00" } }] },
    });
    expect((await verificarSerieParaAcuerdo(prisma, PEDIDO)).ok).toBe(false);
  });

  it("no la adopta si la periodicidad no coincide, si no la organiza él o si la paciente no está invitada", async () => {
    calendar.events.get.mockResolvedValueOnce({ data: SERIE });
    expect((await verificarSerieParaAcuerdo(prisma, { ...PEDIDO, periodicidad: "BIWEEKLY" })).ok).toBe(false);

    calendar.events.get.mockResolvedValueOnce({ data: { ...SERIE, organizer: { self: false } } });
    expect((await verificarSerieParaAcuerdo(prisma, PEDIDO)).ok).toBe(false);

    calendar.events.get.mockResolvedValueOnce({ data: SERIE });
    expect((await verificarSerieParaAcuerdo(prisma, { ...PEDIDO, patientEmail: "otra@example.com" })).ok).toBe(false);

    expect(calendar.events.instances).not.toHaveBeenCalled();
  });
});
