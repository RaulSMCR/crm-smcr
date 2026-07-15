// tests/unit/ownership.test.js
// Verificación de pertenencia en acciones con IDs (SEC-03 / T06).
// Prisma y la sesión están mockeados. Cubre los dos casos representativos:
//   1. Un profesional NO puede cobrar la cita de otro profesional.
//   2. Un paciente NO puede cancelar la cita de otro paciente.
// Más un caso positivo: el profesional dueño sí puede cobrar su cita.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks compartidos: vi.hoisted los eleva junto con las factories de vi.mock,
// evitando el TDZ de referenciar variables top-level dentro de un factory.
const {
  prisma,
  libGetSession,
  actionsGetSession,
  requireProfessionalProfileId,
  sendPaymentRequestEmail,
  sendAppointmentNotifications,
  syncGoogleCalendarEvent,
} = vi.hoisted(() => ({
  prisma: {
    appointment: { findUnique: vi.fn(), update: vi.fn() },
    paymentTransaction: { findFirst: vi.fn(), create: vi.fn() },
    serviceAssignment: { findUnique: vi.fn() },
  },
  libGetSession: vi.fn(),
  actionsGetSession: vi.fn(),
  requireProfessionalProfileId: vi.fn(async () => {
    throw new Error("sin perfil");
  }),
  sendPaymentRequestEmail: vi.fn(),
  sendAppointmentNotifications: vi.fn(),
  syncGoogleCalendarEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
// payment-actions usa @/lib/auth; patient-booking usa @/actions/auth-actions.
vi.mock("@/lib/auth", () => ({ getSession: libGetSession }));
vi.mock("@/actions/auth-actions", () => ({ getSession: actionsGetSession }));
vi.mock("@/lib/auth-guards", () => ({ requireProfessionalProfileId }));
vi.mock("@/lib/appointments", () => ({
  sendPaymentRequestEmail,
  sendAppointmentNotifications,
  syncGoogleCalendarEvent,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/onvo/client", () => ({ buildPaymentLinkUrl: vi.fn(() => "https://checkout.onvopay.com/pay/link1") }));
vi.mock("@/lib/qstash", () => ({ scheduleReminder: vi.fn() }));
vi.mock("@/lib/appointment-recurrence", () => ({
  buildRecurringStarts: (start) => [start],
  normalizeRecurrenceCount: () => 1,
  normalizeRecurrenceRule: () => "NONE",
  RECURRENCE_RULES: { NONE: "NONE" },
}));

import { cobrarCita } from "@/actions/payment-actions";
import { cancelAppointmentByPatient } from "@/actions/patient-booking-actions";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.appointment.update.mockResolvedValue({});
  prisma.paymentTransaction.create.mockResolvedValue({});
});

describe("cobrarCita — pertenencia del profesional (SEC-03)", () => {
  it("un profesional NO puede cobrar la cita de otro profesional", async () => {
    libGetSession.mockResolvedValue({ role: "PROFESSIONAL", professionalProfileId: "proA" });
    prisma.appointment.findUnique.mockResolvedValue({
      id: "apt1",
      status: "COMPLETED",
      paymentStatus: "UNPAID",
      professionalId: "proB", // ← cita de OTRO profesional
      patientId: "patX",
      serviceId: "svc1",
      pricePaid: 25000,
      service: { title: "Consulta" },
      patient: { name: "Paciente", email: "p@x.cr" },
      professional: { user: { name: "Dra. B" } },
    });

    const res = await cobrarCita("apt1");

    expect(res.success).toBe(false);
    expect(res.error).toBe("No autorizado.");
    // No se creó transacción ni se envió correo.
    expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
    expect(sendPaymentRequestEmail).not.toHaveBeenCalled();
  });

  it("el profesional dueño SÍ puede cobrar su cita", async () => {
    libGetSession.mockResolvedValue({ role: "PROFESSIONAL", professionalProfileId: "proA" });
    prisma.appointment.findUnique.mockResolvedValue({
      id: "apt1",
      status: "COMPLETED",
      paymentStatus: "UNPAID",
      professionalId: "proA", // ← su propia cita
      patientId: "patX",
      serviceId: "svc1",
      pricePaid: 25000,
      isFirstWithProfessional: false,
      service: { title: "Consulta" },
      patient: { name: "Paciente", email: "p@x.cr" },
      professional: { user: { name: "Dra. A" } },
    });
    prisma.paymentTransaction.findFirst.mockResolvedValue(null);
    prisma.serviceAssignment.findUnique.mockResolvedValue({ onvoPaymentLinkId: "link1" });

    const res = await cobrarCita("apt1");

    expect(res.success).toBe(true);
    expect(prisma.paymentTransaction.create).toHaveBeenCalledTimes(1);
    expect(sendPaymentRequestEmail).toHaveBeenCalledTimes(1);
  });
});

describe("cancelAppointmentByPatient — pertenencia del paciente (SEC-03)", () => {
  it("un paciente NO puede cancelar la cita de otro paciente", async () => {
    actionsGetSession.mockResolvedValue({ role: "USER", sub: "userA" });
    prisma.appointment.findUnique.mockResolvedValue({
      id: "apt1",
      status: "CONFIRMED",
      patientId: "userB", // ← cita de OTRO paciente
      professional: { user: {} },
      service: {},
      patient: {},
    });

    const res = await cancelAppointmentByPatient("apt1", "no puedo asistir");

    expect(res.error).toMatch(/otros usuarios/i);
    // La cita no se modificó.
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });
});
