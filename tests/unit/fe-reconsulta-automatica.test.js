import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La reconsulta automática: cada corrida de la cola programa la siguiente para
// cuando vence la tarea más próxima. Antes nada la ejecutaba por su cuenta y la
// 0203 se quedó en PENDING hasta que alguien consultó el estado a mano.

const mocks = vi.hoisted(() => ({ publish: vi.fn(), findFirst: vi.fn() }));
vi.mock("@upstash/qstash", () => ({
  Client: vi.fn(function Client() { this.publishJSON = mocks.publish; }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { deliveryJob: { findFirst: mocks.findFirst } } }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send: vi.fn() } } }));
vi.mock("@/lib/fe/config", () => ({ FE_EMISOR: { ambiente: "01" } }));
vi.mock("@/lib/fe/submit", () => ({ submitInvoiceToFe: vi.fn(), sendFeEmail: vi.fn() }));
vi.mock("@/lib/onvo/payment-mail", () => ({ sendPaymentConfirmationEmail: vi.fn() }));

const AHORA = new Date("2026-10-20T15:00:00Z").getTime();

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("QSTASH_TOKEN", "solo-pruebas-local");
  vi.stubEnv("APP_URL", "https://crm.example.invalid");
  mocks.publish.mockResolvedValue({ messageId: "msg-local" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const qstash = () => import("@/lib/qstash");
const cola = () => import("@/lib/payment-deliveries");

describe("despertarColaDeEnvios", () => {
  it("programa el worker de la cola para el minuto en que vence la tarea", async () => {
    const { despertarColaDeEnvios } = await qstash();
    const vence = AHORA + 5 * 60_000 + 10_000; // dentro de 5 min 10 s

    const r = await despertarColaDeEnvios(vence);

    expect(r.programado).toBe(true);
    const [opciones] = mocks.publish.mock.calls[0];
    expect(opciones.url).toBe("https://crm.example.invalid/api/payments/deliveries/run");
    // Redondea al minuto siguiente: nunca antes de que la tarea venza.
    expect(opciones.notBefore * 1000).toBeGreaterThanOrEqual(vence);
    expect(opciones.notBefore % 60).toBe(0);
    expect(opciones.deduplicationId).toBe(`smcr-cola-envios-${opciones.notBefore / 60}`);
  });

  it("dos programaciones para el mismo minuto comparten deduplicación", async () => {
    const { despertarColaDeEnvios } = await qstash();
    await despertarColaDeEnvios(AHORA + 120_000 + 1_000);
    await despertarColaDeEnvios(AHORA + 120_000 + 40_000);

    const [a, b] = mocks.publish.mock.calls.map(([o]) => o.deduplicationId);
    expect(a).toBe(b);
  });

  it("nunca programa antes de 30 s, aunque la tarea ya esté vencida", async () => {
    // Si no, una corrida que deja una tarea vencida se reprogramaría en el acto.
    const { despertarColaDeEnvios } = await qstash();
    await despertarColaDeEnvios(AHORA - 3_600_000);

    expect(mocks.publish.mock.calls[0][0].notBefore * 1000).toBeGreaterThanOrEqual(AHORA + 30_000);
  });

  it("fuera de producción no programa nada", async () => {
    // APP_URL puede apuntar al sitio real: una corrida local despertaría la cola
    // de producción, que habla con Hacienda de verdad.
    vi.stubEnv("NODE_ENV", "test");
    const { despertarColaDeEnvios } = await qstash();

    expect(await despertarColaDeEnvios(AHORA + 60_000)).toEqual({ programado: false, motivo: "FUERA_DE_PRODUCCION" });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("sin token de QStash lo informa y no lanza", async () => {
    vi.stubEnv("QSTASH_TOKEN", "");
    const { despertarColaDeEnvios } = await qstash();
    expect(await despertarColaDeEnvios(AHORA + 60_000)).toEqual({ programado: false, motivo: "SIN_CONFIGURAR" });
  });

  it("si QStash falla no lanza ni vuelca el error", async () => {
    mocks.publish.mockRejectedValue(new Error("token=SECRETO-NO-DEBE-SALIR"));
    const { despertarColaDeEnvios } = await qstash();

    expect(await despertarColaDeEnvios(AHORA + 60_000)).toEqual({ programado: false, motivo: "ERROR" });
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("SECRETO");
  });
});

describe("programarProximaRevision", () => {
  it("con la cola vacía no programa nada: la cadena se apaga sola", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const { programarProximaRevision } = await cola();

    expect(await programarProximaRevision()).toEqual({ programado: false, motivo: "COLA_VACIA" });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("despierta cuando vence la tarea PENDING más próxima", async () => {
    const vence = new Date(AHORA + 4 * 60_000);
    mocks.findFirst.mockImplementation(async ({ where }) => (where.status === "PENDING" ? { nextAttemptAt: vence } : null));
    const { programarProximaRevision } = await cola();

    expect((await programarProximaRevision()).programado).toBe(true);
    expect(mocks.publish.mock.calls[0][0].notBefore * 1000).toBe(AHORA + 4 * 60_000);
  });

  it("también recupera una tarea tomada por una función que murió", async () => {
    const pendiente = new Date(AHORA + 30 * 60_000);
    const candadoVence = new Date(AHORA + 3 * 60_000);
    mocks.findFirst.mockImplementation(async ({ where }) =>
      where.status === "PENDING" ? { nextAttemptAt: pendiente } : { lockedUntil: candadoVence },
    );
    const { programarProximaRevision } = await cola();

    await programarProximaRevision();
    // Gana el que vence primero.
    expect(mocks.publish.mock.calls[0][0].notBefore * 1000).toBe(AHORA + 3 * 60_000);
  });

  it("un error de base no se propaga a quien estaba procesando la cola", async () => {
    mocks.findFirst.mockRejectedValue(new Error("db caída"));
    const { programarProximaRevision } = await cola();
    expect(await programarProximaRevision()).toEqual({ programado: false, motivo: "ERROR" });
  });
});
