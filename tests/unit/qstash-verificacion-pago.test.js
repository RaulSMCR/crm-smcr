import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const publishJSON = vi.hoisted(() => vi.fn());
vi.mock("@upstash/qstash", () => ({ Client: vi.fn(function Client() { this.publishJSON = publishJSON; }) }));

beforeEach(() => {
  vi.resetModules();
  publishJSON.mockReset().mockResolvedValue({ messageId: "msg_test" });
  vi.stubEnv("APP_URL", "https://site.example.invalid");
  vi.stubEnv("QSTASH_TOKEN", "test-only-token");
  vi.stubEnv("NODE_ENV", "production");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const cargar = async () => (await import("@/lib/qstash")).programarVerificacionDePago;

describe("programarVerificacionDePago", () => {
  it("programa a los 5 minutos, con un deduplicationId por pendiente", async () => {
    const programar = await cargar();
    expect(await programar("unm_1")).toEqual({ programado: true });
    expect(publishJSON).toHaveBeenCalledWith({
      url: "https://site.example.invalid/api/payment/unmatched-check",
      delay: 300,
      deduplicationId: "smcr-onvo-pendiente-unm_1",
      body: { unmatchedId: "unm_1" },
    });
  });

  it("fuera de producción no programa, para que quien llama alerte en el acto", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const programar = await cargar();
    expect(await programar("unm_1")).toEqual({ programado: false, motivo: "FUERA_DE_PRODUCCION" });
    expect(publishJSON).not.toHaveBeenCalled();
  });

  it("sin token no programa", async () => {
    vi.stubEnv("QSTASH_TOKEN", "");
    const programar = await cargar();
    expect(await programar("unm_1")).toMatchObject({ programado: false, motivo: "SIN_CONFIGURAR" });
  });

  it("si QStash falla no lanza ni vuelca el error", async () => {
    publishJSON.mockRejectedValue(new Error("https://qstash.example.invalid?token=secreto"));
    const programar = await cargar();
    expect(await programar("unm_1")).toEqual({ programado: false, motivo: "ERROR" });
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("secreto");
  });
});
