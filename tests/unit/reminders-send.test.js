import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  notify: vi.fn(),
  sync: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/lib/qstash-webhook", () => ({ withQstashSignature: (handler) => handler }));
vi.mock("@/lib/prisma", () => ({ prisma: { appointment: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/appointments", () => ({ sendAppointmentNotifications: mocks.notify, syncGoogleCalendarEvent: mocks.sync }));
vi.mock("@/lib/push/send", () => ({ sendPushToUser: mocks.push }));

import { POST } from "@/app/api/reminders/send/route";
import { recordatoriosDeCita } from "@/lib/recordatorios";

const DATE = new Date("2026-11-03T01:00:00Z");
const MEET = "https://meet.google.com/abc-defg-hij";
const cita = (extra = {}) => ({
  id: "apt-1", patientId: "p-1", date: DATE, status: "CONFIRMED", modality: "VIRTUAL", meetLink: MEET,
  professional: { googleRefreshToken: "token", user: { name: "Pro", email: "pro@example.invalid" } },
  patient: { name: "Paciente", email: "p@example.invalid" }, service: { title: "Sesión" }, ...extra,
});
const request = (body) => new Request("https://example.invalid/api/reminders/send", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const opciones = () => mocks.notify.mock.calls[0][3];

beforeEach(() => vi.resetAllMocks());

describe("recordatoriosDeCita", () => {
  it("programa uno a las 24 h y el último 10 minutos antes, con la fecha de la cita", () => {
    expect(recordatoriosDeCita({ id: "apt-1", date: DATE })).toEqual([
      { appointmentId: "apt-1", type: "24h", sendAt: new Date("2026-11-02T01:00:00Z"), appointmentDate: DATE.toISOString() },
      { appointmentId: "apt-1", type: "10m", sendAt: new Date("2026-11-03T00:50:00Z"), appointmentDate: DATE.toISOString() },
    ]);
  });
});

describe("recordatorio de los 10 minutos", () => {
  it("lleva el enlace de Meet de la sesión virtual", async () => {
    mocks.findUnique.mockResolvedValue(cita());
    await POST(request({ appointmentId: "apt-1", type: "10m", appointmentDate: DATE.toISOString() }));
    expect(mocks.notify.mock.calls[0][1]).toBe("Recordatorio: la cita inicia en 10 minutos.");
    expect(opciones()).toEqual({ enlaceVirtual: MEET });
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("si falta el enlace se lo pide a Google antes de enviar", async () => {
    mocks.findUnique.mockResolvedValueOnce(cita({ meetLink: null })).mockResolvedValueOnce({ meetLink: MEET });
    await POST(request({ appointmentId: "apt-1", type: "10m" }));
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    expect(opciones()).toEqual({ enlaceVirtual: MEET });
  });

  it("sin enlace posible avisa al profesional para que lo mande", async () => {
    mocks.findUnique.mockResolvedValueOnce(cita({ meetLink: null })).mockResolvedValueOnce({ meetLink: null });
    await POST(request({ appointmentId: "apt-1", type: "10m" }));
    expect(opciones()).toMatchObject({ enlaceVirtual: false, notaProfesional: expect.stringContaining("Google Meet") });
  });

  it("una cita presencial no lleva enlace", async () => {
    mocks.findUnique.mockResolvedValue(cita({ modality: "OFFICE", meetLink: null }));
    await POST(request({ appointmentId: "apt-1", type: "10m" }));
    expect(opciones()).toEqual({});
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});

describe("recordatorios en general", () => {
  it("el de 24 h no manda el enlace todavía", async () => {
    mocks.findUnique.mockResolvedValue(cita());
    await POST(request({ appointmentId: "apt-1", type: "24h" }));
    expect(opciones()).toEqual({});
  });

  it("descarta el recordatorio de una cita reagendada después de programarlo", async () => {
    mocks.findUnique.mockResolvedValue(cita());
    const response = await POST(request({ appointmentId: "apt-1", type: "10m", appointmentDate: "2026-11-01T01:00:00.000Z" }));
    expect(await response.json()).toMatchObject({ skipped: true, reason: "Appointment rescheduled" });
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("los mensajes de 1 h ya programados se siguen enviando", async () => {
    mocks.findUnique.mockResolvedValue(cita());
    await POST(request({ appointmentId: "apt-1", type: "1h" }));
    expect(mocks.notify.mock.calls[0][1]).toBe("Recordatorio: la cita inicia en 1 hora.");
  });
});
