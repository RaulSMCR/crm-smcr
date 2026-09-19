import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, send, createPaymentLink } = vi.hoisted(() => ({
  prisma: {
    paymentTransaction: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  },
  send: vi.fn(),
  createPaymentLink: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send } } }));
vi.mock("@/lib/google", () => ({ getCalendarClient: vi.fn() }));
vi.mock("@/lib/booking-rates", () => ({ resolveBookingSelection: vi.fn() }));
vi.mock("@/lib/onvo/client", () => ({
  createPaymentLink,
  buildPaymentLinkUrl: (id) => `https://buy.onvopay.com/${id}`,
}));

import { sendPaymentRequestEmail } from "@/lib/appointments";
import { createPaymentRequestForAppointment } from "@/lib/payment-requests";

const paymentUrl = "https://buy.onvopay.com/live_example";
const appointment = {
  id: "appointment1", patientId: "patient1", professionalId: "professional1",
  pricePaid: 2000, isFirstWithProfessional: true,
  patient: { name: "Paciente", email: "paciente@example.com" },
  professional: { academicDegree: "licenciado", user: { name: "Profesional" } },
  service: { title: "Consulta" },
};
const email = {
  patientEmail: appointment.patient.email, patientName: appointment.patient.name,
  processUrl: paymentUrl, amount: 1000, serviceTitle: "Consulta",
  proName: "Profesional", paymentType: "DEPOSIT_50",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESEND_API_KEY", "re_test_example");
  vi.spyOn(console, "error").mockImplementation(() => {});
  send.mockResolvedValue({ data: { id: "email1" }, error: null });
  createPaymentLink.mockResolvedValue({ id: "live_example", url: paymentUrl });
  prisma.paymentTransaction.findFirst.mockResolvedValue(null);
  prisma.paymentTransaction.create.mockImplementation(async ({ data }) => ({ id: "tx1", ...data }));
  prisma.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("correo de cobro: aceptación del proveedor", () => {
  it("envía el enlace y devuelve la referencia del proveedor", async () => {
    await expect(sendPaymentRequestEmail(email)).resolves.toEqual({ providerId: "email1" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: appointment.patient.email,
      subject: "Pago de adelanto 50% - primera cita",
      html: expect.stringContaining(`href="${paymentUrl}"`),
    }));
  });

  it.each([
    { data: null, error: { message: "rechazado" } },
    { data: {}, error: null },
  ])("rechaza una respuesta sin confirmación de envío (%j)", async (response) => {
    send.mockResolvedValue(response);
    await expect(sendPaymentRequestEmail(email)).rejects.toThrow("PAYMENT_EMAIL_NOT_ACCEPTED");
  });

  it("propaga un fallo de red sin exponer detalles del proveedor", async () => {
    send.mockRejectedValue(new Error("provider private detail"));
    await expect(sendPaymentRequestEmail(email)).rejects.toThrow("PAYMENT_EMAIL_NOT_ACCEPTED");
  });

  it.each(["", "re_dummy_key"])("no confirma envío sin configuración (%s)", async (key) => {
    vi.stubEnv("RESEND_API_KEY", key);
    await expect(sendPaymentRequestEmail(email)).rejects.toThrow("PAYMENT_EMAIL_NOT_CONFIGURED");
    expect(send).not.toHaveBeenCalled();
  });

  it("no confirma envío sin destinatario", async () => {
    await expect(sendPaymentRequestEmail({ ...email, patientEmail: null }))
      .rejects.toThrow("PAYMENT_EMAIL_RECIPIENT_MISSING");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("adelanto: persistencia y recuperación del correo", () => {
  it("guarda el adelanto pendiente antes de enviar y lo marca enviado tras la aceptación", async () => {
    send.mockImplementation(async () => {
      expect(prisma.paymentTransaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({
        amount: 1000, type: "DEPOSIT_50", status: "PENDING",
      }) });
      expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
      return { data: { id: "email1" }, error: null };
    });
    await expect(createPaymentRequestForAppointment(appointment, "DEPOSIT_50"))
      .resolves.toMatchObject({ success: true, amount: 1000, paymentUrl });
    expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith({
      where: { id: "tx1", status: { in: ["PENDING", "LINK_SENT"] } },
      data: { status: "LINK_SENT" },
    });
  });

  it("conserva el enlace si el proveedor rechaza y lo reutiliza al reintentar", async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: "rechazado" } });
    await expect(createPaymentRequestForAppointment(appointment, "DEPOSIT_50"))
      .resolves.toMatchObject({ success: false, code: "PAYMENT_EMAIL_FAILED", paymentUrl });
    expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
    const saved = await prisma.paymentTransaction.create.mock.results[0].value;
    expect(saved.status).toBe("PENDING");
    prisma.paymentTransaction.findFirst.mockResolvedValue(saved);
    await expect(createPaymentRequestForAppointment(appointment, "DEPOSIT_50"))
      .resolves.toMatchObject({ success: true, reused: true, paymentUrl });
    expect(createPaymentLink).toHaveBeenCalledTimes(1);
    expect(prisma.paymentTransaction.create).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("no sustituye APPROVED cuando el webhook acredita durante el envío", async () => {
    let currentStatus = "PENDING";
    send.mockImplementation(async () => {
      currentStatus = "APPROVED";
      return { data: { id: "email1" }, error: null };
    });
    prisma.paymentTransaction.updateMany.mockImplementation(async ({ where, data }) => {
      if (!where.status.in.includes(currentStatus)) return { count: 0 };
      currentStatus = data.status;
      return { count: 1 };
    });
    await createPaymentRequestForAppointment(appointment, "DEPOSIT_50");
    expect(currentStatus).toBe("APPROVED");
  });

  it("no envía correo ni guarda una transacción si ONVO no genera el enlace", async () => {
    createPaymentLink.mockRejectedValue(new Error("ONVO failed"));
    await expect(createPaymentRequestForAppointment(appointment, "DEPOSIT_50"))
      .resolves.toMatchObject({ success: false, code: "ONVO_LINK_FAILED" });
    expect(send).not.toHaveBeenCalled();
    expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
  });
});
