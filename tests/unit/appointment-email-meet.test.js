import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn(async () => ({ data: { id: "mail" } })));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send } } }));
vi.mock("@/lib/google", () => ({ getCalendarClient: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { sendAppointmentNotifications } from "@/lib/appointments";

const MEET = "https://meet.google.com/abc-defg-hij";
const cita = {
  id: "apt-1", date: new Date("2026-11-03T01:00:00Z"), endDate: new Date("2026-11-03T02:00:00Z"),
  status: "CONFIRMED", modality: "VIRTUAL", locationName: "Videollamada",
  patient: { name: "Paciente", email: "p@example.invalid" },
  professional: { user: { name: "Pro", email: "pro@example.invalid" } },
  service: { title: "Sesión" },
};
const html = (to) => send.mock.calls.find(([mail]) => mail.to === to)[0].html;

beforeEach(() => {
  send.mockClear();
  vi.stubEnv("RESEND_API_KEY", "re_test_local");
});

describe("correo de una sesión virtual", () => {
  it("con enlace, los dos correos llevan el botón de Meet", async () => {
    await sendAppointmentNotifications(cita, "Recordatorio", null, { enlaceVirtual: MEET });
    for (const to of ["p@example.invalid", "pro@example.invalid"]) {
      expect(html(to)).toContain(`href="${MEET}"`);
      expect(html(to)).not.toContain("10 minutos antes");
    }
  });

  it("el correo del profesional trae el enlace listo para reenviar por WhatsApp; el del paciente no", async () => {
    const conTelefono = { ...cita, patient: { ...cita.patient, phone: "88881234" } };
    await sendAppointmentNotifications(conTelefono, "Recordatorio", null, { enlaceVirtual: MEET });
    expect(html("pro@example.invalid")).toContain("https://wa.me/50688881234?text=");
    expect(html("p@example.invalid")).not.toContain("wa.me");
  });

  it("sin enlace todavía, anuncia que llega 10 minutos antes", async () => {
    await sendAppointmentNotifications(cita, "Cita confirmada");
    expect(html("p@example.invalid")).toContain("10 minutos antes");
    expect(html("p@example.invalid")).not.toContain("meet.google.com");
  });

  it("si tocaba mandarlo y no hay, no promete nada al paciente y avisa solo al profesional", async () => {
    await sendAppointmentNotifications(cita, "Recordatorio", null, { enlaceVirtual: false, notaProfesional: "NOTA_PRO" });
    expect(html("p@example.invalid")).toContain("El profesional le enviará el enlace");
    expect(html("p@example.invalid")).not.toContain("NOTA_PRO");
    expect(html("pro@example.invalid")).toContain("NOTA_PRO");
  });
});
