import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseGaClientId, makeSyntheticClientId } from "../../src/lib/analytics/client-identifiers.js";
import { deterministicClientId } from "../../src/lib/analytics/reportDepositConversion.js";
import { sendServerConversionEvent } from "../../src/lib/analytics/sendServerConversionEvent.js";

describe("parseGaClientId", () => {
  it("extrae el client_id del cookie _ga", () => {
    expect(parseGaClientId("_ga=GA1.1.1234567890.1234567890")).toBe("1234567890.1234567890");
  });

  it("lo encuentra entre otros cookies", () => {
    expect(parseGaClientId("foo=bar; _ga=GA1.2.987654321.111222333; x=y")).toBe("987654321.111222333");
  });

  it("devuelve '' si no hay _ga (sin consentimiento)", () => {
    expect(parseGaClientId("foo=bar; consent=denied")).toBe("");
    expect(parseGaClientId("")).toBe("");
    expect(parseGaClientId(null)).toBe("");
  });
});

describe("makeSyntheticClientId", () => {
  it("tiene el formato de GA4 (dos enteros separados por punto)", () => {
    expect(makeSyntheticClientId()).toMatch(/^\d+\.\d+$/);
  });
});

describe("deterministicClientId", () => {
  it("es estable para la misma semilla (idempotencia entre reintentos)", () => {
    const a = deterministicClientId("txn_abc123");
    const b = deterministicClientId("txn_abc123");
    expect(a).toBe(b);
    expect(a).toMatch(/^\d+\.\d+$/);
  });

  it("difiere entre semillas distintas", () => {
    expect(deterministicClientId("txn_a")).not.toBe(deterministicClientId("txn_b"));
  });
});

describe("sendServerConversionEvent", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("omite el envío (false) si falta GA4_API_SECRET", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    vi.stubEnv("GA4_API_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ok = await sendServerConversionEvent({ clientId: "1.2", transactionId: "t1", value: 100 });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no envía si falta client_id", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    vi.stubEnv("GA4_API_SECRET", "secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ok = await sendServerConversionEvent({ clientId: "", transactionId: "t1", value: 100 });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("postea a GA4 MP con el payload correcto y devuelve true en 204", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    vi.stubEnv("GA4_API_SECRET", "secret");
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const ok = await sendServerConversionEvent({
      clientId: "111.222",
      gclid: "CjwK_test",
      transactionId: "txn_1",
      value: 22750,
      currency: "CRC",
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("measurement_id=G-TEST");
    expect(url).toContain("api_secret=secret");
    const body = JSON.parse(options.body);
    expect(body.client_id).toBe("111.222");
    expect(body.events[0].name).toBe("deposit_paid");
    expect(body.events[0].params).toMatchObject({
      transaction_id: "txn_1",
      value: 22750,
      currency: "CRC",
      gclid: "CjwK_test",
    });
  });

  it("omite gclid del payload cuando no existe", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    vi.stubEnv("GA4_API_SECRET", "secret");
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendServerConversionEvent({ clientId: "1.2", transactionId: "t2", value: 100 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0].params).not.toHaveProperty("gclid");
  });

  it("devuelve false si GA4 responde no-ok", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    vi.stubEnv("GA4_API_SECRET", "secret");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400 })));

    const ok = await sendServerConversionEvent({ clientId: "1.2", transactionId: "t3", value: 100 });
    expect(ok).toBe(false);
  });
});
