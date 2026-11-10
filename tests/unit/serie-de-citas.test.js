import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, send, insert, patch } = vi.hoisted(() => ({
  prisma: {
    appointment: { update: vi.fn() },
    professionalProfile: { findUnique: vi.fn() },
  },
  send: vi.fn(),
  insert: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send } } }));
vi.mock("@/lib/google", () => ({ getCalendarClient: () => ({ events: { insert, patch } }) }));

import { agruparParaGoogle, esInstanciaDeSerie, reglaDeSerie } from "@/lib/serie-de-citas";
import { sendSeriesNotifications, sincronizarCitasConGoogle } from "@/lib/appointments";

const SEMANA = 7 * 24 * 3600 * 1000;
const CREADA = new Date("2026-11-10T02:03:46.388Z");

function serie(n, { paso = SEMANA, createdAt = CREADA, ...resto } = {}) {
  const base = Date.parse("2026-11-17T01:00:00Z");
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    patientId: "pac", professionalId: "pro", acuerdoId: null,
    date: new Date(base + i * paso), endDate: new Date(base + i * paso + 50 * 60000),
    status: "CONFIRMED", gcalEventId: null, createdAt,
    patient: { name: "Paciente", email: "paciente@example.com" },
    professional: { googleRefreshToken: "rt", user: { name: "Profesional", email: "pro@example.com" } },
    service: { title: "Psicoterapia" },
    ...resto,
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESEND_API_KEY", "re_test_example");
  send.mockResolvedValue({ data: { id: "e1" }, error: null });
  prisma.professionalProfile.findUnique.mockResolvedValue({ googleCalendarId: "consultorio@group" });
  insert.mockResolvedValue({ data: { id: "maestro", hangoutLink: "https://meet.google.com/abc" } });
});

afterEach(() => vi.unstubAllEnvs());

describe("regla de la serie", () => {
  it("doce lunes seguidos son FREQ=WEEKLY;COUNT=12", () => {
    expect(reglaDeSerie(serie(12))).toMatchObject({ rrule: "RRULE:FREQ=WEEKLY;COUNT=12", intervaloSemanas: 1 });
  });

  it("cada dos semanas lleva INTERVAL", () => {
    expect(reglaDeSerie(serie(4, { paso: 2 * SEMANA })).rrule).toBe("RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4");
  });

  it("fechas irregulares o una sola cita no son serie", () => {
    const irregulares = serie(3);
    irregulares[2].date = new Date(irregulares[2].date.getTime() + 3600000);
    expect(reglaDeSerie(irregulares)).toBeNull();
    expect(reglaDeSerie(serie(1))).toBeNull();
  });

  it("agrupa solo las que nacieron juntas", () => {
    const juntas = serie(3);
    const otra = serie(1, { createdAt: new Date("2026-11-11T00:00:00Z") }).map((c) => ({ ...c, id: "x" }));
    const { series, sueltas } = agruparParaGoogle([...juntas, ...otra]);
    expect(series).toHaveLength(1);
    expect(series[0].citas.map((c) => c.id)).toEqual(["c0", "c1", "c2"]);
    expect(sueltas.map((c) => c.id)).toEqual(["x"]);
  });

  it("reconoce el id de una instancia", () => {
    expect(esInstanciaDeSerie("maestro_20261117T010000Z")).toBe(true);
    expect(esInstanciaDeSerie("ttq69su1leklmbut36outj3aak")).toBe(false);
  });
});

describe("publicación en Google", () => {
  it("doce citas nuevas son un solo evento recurrente y cada una apunta a su instancia", async () => {
    await sincronizarCitasConGoogle(serie(12));
    expect(insert).toHaveBeenCalledTimes(1);
    const { requestBody, sendUpdates, calendarId } = insert.mock.calls[0][0];
    expect(calendarId).toBe("consultorio@group");
    expect(sendUpdates).toBe("all");
    expect(requestBody.recurrence).toEqual(["RRULE:FREQ=WEEKLY;COUNT=12"]);
    expect(prisma.appointment.update).toHaveBeenCalledTimes(12);
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "c0" },
      data: { gcalEventId: "maestro_20261117T010000Z", meetLink: "https://meet.google.com/abc" },
    });
  });

  it("una instancia se actualiza sin pedir sala propia", async () => {
    patch.mockResolvedValue({ data: {} });
    const [cita] = serie(1, { gcalEventId: "maestro_20261117T010000Z", status: "COMPLETED" });
    await sincronizarCitasConGoogle([cita]);
    expect(insert).not.toHaveBeenCalled();
    expect(patch.mock.calls[0][0].requestBody.conferenceData).toBeUndefined();
  });
});

describe("correo de la serie", () => {
  it("manda un correo por destinatario, no uno por cita", async () => {
    await sendSeriesNotifications(serie(12), "Su profesional agendó su próxima cita.", { titulo: "Cita agendada" });
    expect(send).toHaveBeenCalledTimes(2);
    const alPaciente = send.mock.calls.find(([m]) => m.to === "paciente@example.com")[0];
    expect(alPaciente.subject).toBe("Cita agendada (recurrente)");
    expect(alPaciente.html).toContain("Cita recurrente: cada semana, 12 sesiones.");
    expect(alPaciente.html.match(/<li>/g).length).toBeGreaterThanOrEqual(12);
  });
});
