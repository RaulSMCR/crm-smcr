// tests/unit/onvo-observability-cabeceras.test.js
//
// El logger del webhook tiene una lista blanca justamente para que nadie meta
// una cabecera o un payload en los logs de Vercel. Registrar los NOMBRES de las
// cabeceras es una excepción deliberada —sirve para saber si ONVO autentica con
// un secreto compartido o con una firma— y lo que se fija acá es que siga
// siendo solo eso: nombres, nunca valores.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logOnvoWebhook } from "@/lib/onvo/observability";

let warn;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const registrado = () => warn.mock.calls.at(-1)[1];

describe("logOnvoWebhook — nombres de cabeceras", () => {
  it("registra los nombres recibidos, ordenados", () => {
    logOnvoWebhook("warn", "AUTH_REJECTED", {
      headerNames: ["x-webhook-secret", "content-type", "host"],
    });

    expect(registrado().headerNames).toBe("content-type,host,x-webhook-secret");
  });

  it("distingue una cabecera ausente de un valor distinto", () => {
    logOnvoWebhook("warn", "AUTH_REJECTED", { reason: "SECRET_HEADER_ABSENT" });
    expect(registrado().reason).toBe("SECRET_HEADER_ABSENT");

    logOnvoWebhook("warn", "AUTH_REJECTED", { reason: "SECRET_MISMATCH" });
    expect(registrado().reason).toBe("SECRET_MISMATCH");
  });

  it("descarta cualquier nombre que no parezca uno: ahí es donde se colaría un valor", () => {
    logOnvoWebhook("warn", "AUTH_REJECTED", {
      headerNames: ["x-webhook-secret", "webhook_secret_6-XbcSemlLHyejcZ", "Bearer abc.def", ""],
    });

    // Guiones bajos, espacios y puntos no aparecen en nombres de cabecera HTTP,
    // pero sí en secretos y tokens.
    expect(registrado().headerNames).toBe("x-webhook-secret");
  });

  it("no acepta un objeto de cabeceras completo, que traería los valores", () => {
    logOnvoWebhook("warn", "AUTH_REJECTED", {
      headerNames: { "x-webhook-secret": "webhook_secret_6-XbcSemlLHyejcZ" },
    });

    expect(registrado().headerNames).toBeUndefined();
  });

  it("no inventa el campo cuando no se le pasa nada", () => {
    logOnvoWebhook("warn", "AUTH_REJECTED");
    expect(registrado().headerNames).toBeUndefined();
  });

  it("acota la cantidad para que un emisor hostil no llene el log", () => {
    const muchas = Array.from({ length: 80 }, (_, i) => `x-relleno-${i}`);
    logOnvoWebhook("warn", "AUTH_REJECTED", { headerNames: muchas });

    expect(registrado().headerNames.split(",")).toHaveLength(40);
  });
});
