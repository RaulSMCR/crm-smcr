// tests/integration/payment-flow.test.js
//
// Tests de integración para el flujo webhook → DB.
// Usa mocks de Prisma para no necesitar DB real.
//
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock de prisma
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    paymentTransaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    appointment: {
      update: vi.fn(),
    },
  },
}));

// Mock de resend para no enviar emails reales
vi.mock("../../src/lib/resend.js", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "mock-email-id" }, error: null }),
    },
  },
}));

vi.stubEnv("PLACETOPAY_SECRET_KEY", "test_secret_key");
vi.stubEnv("EMAIL_FROM", "test@example.com");
vi.stubEnv("RESEND_API_KEY", "re_test_key");

const { prisma } = await import("../../src/lib/prisma.js");

// Helper para construir firma válida
function makeSignature(requestId, status, date) {
  return crypto
    .createHash("sha1")
    .update(`${requestId}${status}${date}${"test_secret_key"}`)
    .digest("hex");
}

// Helper para construir un Request simulado
function makeWebhookRequest(payload) {
  return {
    json: async () => payload,
    headers: {
      get: (key) => {
        if (key === "x-forwarded-for") return "1.2.3.4";
        if (key === "user-agent") return "PlacetoPay/1.0";
        return null;
      },
    },
  };
}

describe("Webhook /api/payment/webhook — flujo de integración", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("APPROVED depósito: actualiza transacción → APPROVED y cita → PARTIALLY_PAID", async () => {
    const requestId = 9001;
    const status    = "APPROVED";
    const date      = "2026-03-06T10:00:00-06:00";
    const signature = makeSignature(requestId, status, date);

    const mockTransaction = {
      id: "tx-1",
      type: "DEPOSIT_50",
      appointmentId: "appt-1",
      status: "PROCESSING",
      patient:      { name: "Juan", email: "juan@test.com" },
      professional: { user: { name: "Dr. García", email: "garcia@test.com" } },
      amount: 25000,
      currency: "CRC",
      appointment: { id: "appt-1", isFirstWithProfessional: true, paymentStatus: "UNPAID" },
    };

    prisma.paymentTransaction.findUnique.mockResolvedValueOnce(mockTransaction);
    prisma.paymentTransaction.update.mockResolvedValueOnce({ ...mockTransaction, status: "APPROVED" });
    prisma.appointment.update.mockResolvedValueOnce({ id: "appt-1", paymentStatus: "PARTIALLY_PAID" });

    // Importar el handler dinámicamente para que tome los mocks
    const { POST } = await import("../../src/app/api/payment/webhook/route.js");
    const req = makeWebhookRequest({
      requestId,
      status: { status, reason: "00", message: "Aprobada", date },
      signature,
    });

    const response = await POST(req);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-1" },
        data: expect.objectContaining({ status: "APPROVED" }),
      })
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: expect.objectContaining({ paymentStatus: "PARTIALLY_PAID" }),
      })
    );
  });

  it("APPROVED balance/full: actualiza cita → PAID", async () => {
    const requestId = 9002;
    const status    = "APPROVED";
    const date      = "2026-03-06T11:00:00-06:00";
    const signature = makeSignature(requestId, status, date);

    const mockTransaction = {
      id: "tx-2",
      type: "FULL_100",
      appointmentId: "appt-2",
      status: "PROCESSING",
      patient:      { name: "María", email: "maria@test.com" },
      professional: { user: { name: "Dra. López", email: "lopez@test.com" } },
      amount: 50000,
      currency: "CRC",
      appointment: { id: "appt-2", isFirstWithProfessional: false, paymentStatus: "UNPAID" },
    };

    prisma.paymentTransaction.findUnique.mockResolvedValueOnce(mockTransaction);
    prisma.paymentTransaction.update.mockResolvedValueOnce({ ...mockTransaction, status: "APPROVED" });
    prisma.appointment.update.mockResolvedValueOnce({ id: "appt-2", paymentStatus: "PAID" });

    const { POST } = await import("../../src/app/api/payment/webhook/route.js");
    const req = makeWebhookRequest({
      requestId,
      status: { status, reason: "00", message: "Aprobada", date },
      signature,
    });

    const response = await POST(req);
    expect((await response.json()).ok).toBe(true);
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: "PAID" }),
      })
    );
  });

  it("Firma inválida: descarta notificación sin tocar DB", async () => {
    const { POST } = await import("../../src/app/api/payment/webhook/route.js");
    const req = makeWebhookRequest({
      requestId: 9003,
      status: { status: "APPROVED", reason: "00", message: "Aprobada", date: "2026-03-06T12:00:00-06:00" },
      signature: "invalid_signature_xyz",
    });

    const response = await POST(req);
    const body = await response.json();

    expect(body.ok).toBe(false);
    expect(prisma.paymentTransaction.findUnique).not.toHaveBeenCalled();
    expect(prisma.paymentTransaction.update).not.toHaveBeenCalled();
  });

  it("Idempotencia: transacción ya APPROVED no se reprocesa", async () => {
    const requestId = 9004;
    const status    = "APPROVED";
    const date      = "2026-03-06T13:00:00-06:00";
    const signature = makeSignature(requestId, status, date);

    // Simular transacción ya aprobada
    prisma.paymentTransaction.findUnique.mockResolvedValueOnce({
      id: "tx-4",
      type: "DEPOSIT_50",
      appointmentId: "appt-4",
      status: "APPROVED", // ← ya procesada
      patient: { name: "Pedro", email: "pedro@test.com" },
      professional: { user: { name: "Dr. Soto" } },
      amount: 15000,
      currency: "CRC",
      appointment: { paymentStatus: "PARTIALLY_PAID" },
    });

    const { POST } = await import("../../src/app/api/payment/webhook/route.js");
    const req = makeWebhookRequest({
      requestId,
      status: { status, reason: "00", message: "Aprobada", date },
      signature,
    });

    await POST(req);

    // No debe actualizar nada
    expect(prisma.paymentTransaction.update).not.toHaveBeenCalled();
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it("REJECTED: actualiza transacción → REJECTED, no cambia paymentStatus de cita", async () => {
    const requestId = 9005;
    const status    = "REJECTED";
    const date      = "2026-03-06T14:00:00-06:00";
    const signature = makeSignature(requestId, status, date);

    const mockTransaction = {
      id: "tx-5",
      type: "DEPOSIT_50",
      appointmentId: "appt-5",
      status: "PROCESSING",
      patient:      { name: "Ana", email: "ana@test.com" },
      professional: { user: { name: "Dr. Mora" } },
      amount: 20000,
      currency: "CRC",
      appointment: { id: "appt-5", isFirstWithProfessional: true, paymentStatus: "UNPAID" },
    };

    prisma.paymentTransaction.findUnique.mockResolvedValueOnce(mockTransaction);
    prisma.paymentTransaction.update.mockResolvedValueOnce({ ...mockTransaction, status: "REJECTED" });

    const { POST } = await import("../../src/app/api/payment/webhook/route.js");
    const req = makeWebhookRequest({
      requestId,
      status: { status, reason: "05", message: "Rechazada", date },
      signature,
    });

    await POST(req);

    expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED" }),
      })
    );
    // No debe actualizar paymentStatus de la cita
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });
});
