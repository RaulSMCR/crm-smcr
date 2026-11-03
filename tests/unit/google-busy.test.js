import { beforeEach, describe, expect, it, vi } from "vitest";

const eventsList = vi.fn();
vi.mock("@/lib/google", () => ({
  getCalendarClient: () => ({ events: { list: (...args) => eventsList(...args) } }),
}));

const { fetchBusyForProfessional } = await import("@/lib/google-busy");

// La cita que publicó la app en el calendario de trabajo, con el profesional
// invitado: Google la muestra con el mismo id en su calendario personal.
const citaPublicada = {
  id: "evento-de-la-cita",
  status: "confirmed",
  start: { dateTime: "2026-11-09T19:00:00-06:00" },
  end: { dateTime: "2026-11-09T19:50:00-06:00" },
};
const compromisoPersonal = {
  id: "dentista",
  status: "confirmed",
  start: { dateTime: "2026-11-09T15:00:00-06:00" },
  end: { dateTime: "2026-11-09T16:00:00-06:00" },
};

const prisma = {
  professionalProfile: {
    findUnique: async () => ({
      googleRefreshToken: "token",
      googleCalendarId: "consultorio@group.calendar.google.com",
      googleBusyCalendarIds: ["personal@gmail.com"],
    }),
  },
};

beforeEach(() => {
  eventsList.mockReset().mockImplementation(async ({ calendarId }) => ({
    data: {
      items: calendarId === "personal@gmail.com" ? [citaPublicada, compromisoPersonal] : [citaPublicada],
    },
  }));
});

describe("fetchBusyForProfessional", () => {
  it("excluye las citas propias también de los calendarios que ocupan, no solo del de trabajo", async () => {
    const ocupado = await fetchBusyForProfessional({
      prisma,
      professionalId: "pro",
      from: new Date("2026-11-09T00:00:00-06:00"),
      to: new Date("2026-11-10T00:00:00-06:00"),
      excludeEventIds: ["evento-de-la-cita"],
    });

    expect(ocupado).toHaveLength(1);
    expect(ocupado[0].startISO).toBe(new Date("2026-11-09T15:00:00-06:00").toISOString());
  });
});
