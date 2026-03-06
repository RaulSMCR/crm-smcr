// tests/unit/placetopay-client.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mockear variables de entorno antes de importar
vi.stubEnv("PLACETOPAY_LOGIN", "test_login");
vi.stubEnv("PLACETOPAY_SECRET_KEY", "test_secret");
vi.stubEnv("PLACETOPAY_BASE_URL", "https://checkout-qa.placetopay.dev");
vi.stubEnv("APP_URL", "http://localhost:3000");

const { createSession, querySession } = await import("../../src/lib/placetopay/client.js");

const MOCK_CREATE_RESPONSE = {
  requestId: 12345,
  status: { status: "OK", reason: "CT", message: "Created", date: "2026-03-06T10:00:00-06:00" },
  processUrl: "https://checkout-qa.placetopay.dev/spa/session/12345/cc?token=abc",
};

const MOCK_QUERY_APPROVED = {
  requestId: 12345,
  status: { status: "APPROVED", reason: "00", message: "Aprobada", date: "2026-03-06T10:05:00-06:00" },
  payment: [{ status: "APPROVED", reference: "REF-123" }],
};

const MOCK_QUERY_REJECTED = {
  requestId: 12345,
  status: { status: "REJECTED", reason: "05", message: "Rechazada", date: "2026-03-06T10:05:00-06:00" },
  payment: [],
};

describe("createSession()", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("retorna requestId y processUrl en respuesta exitosa", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_CREATE_RESPONSE,
    });

    const result = await createSession({
      reference: "DEP-abc123",
      description: "Depósito 50%",
      amount: 25000,
      currency: "CRC",
      returnUrl: "http://localhost:3000/panel/paciente/pago/resultado",
    });

    expect(result.requestId).toBe(12345);
    expect(result.processUrl).toContain("checkout-qa.placetopay.dev");
  });

  it("lanza error si P2P responde con status FAILED", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        status: { status: "FAILED", message: "Credenciales inválidas" },
      }),
    });

    await expect(
      createSession({ reference: "REF-1", description: "Test", amount: 100 })
    ).rejects.toThrow("Credenciales inválidas");
  });

  it("lanza error si fetch falla (red caída)", async () => {
    fetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(
      createSession({ reference: "REF-2", description: "Test", amount: 100 })
    ).rejects.toThrow("Network error");
  });
});

describe("querySession()", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("retorna status APPROVED correctamente", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_QUERY_APPROVED,
    });

    const result = await querySession(12345);
    expect(result.status).toBe("APPROVED");
    expect(result.payment).toHaveLength(1);
  });

  it("retorna status REJECTED correctamente", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_QUERY_REJECTED,
    });

    const result = await querySession(12345);
    expect(result.status).toBe("REJECTED");
    expect(result.payment).toHaveLength(0);
  });

  it("lanza error si el response no es ok", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ status: { message: "Sesión no encontrada" } }),
    });
    await expect(querySession(99999)).rejects.toThrow("Sesión no encontrada");
  });
});
