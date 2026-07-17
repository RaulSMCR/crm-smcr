import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { hashEmail, hashPhone, utmCustomData, sendMetaEvent } from "../../src/lib/meta-capi.js";

const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");

describe("hashEmail", () => {
  it("normaliza (lowercase + trim) antes de hashear", () => {
    expect(hashEmail("  Test@Example.COM ")).toBe(sha("test@example.com"));
  });
  it("devuelve null si está vacío", () => {
    expect(hashEmail("")).toBeNull();
    expect(hashEmail(null)).toBeNull();
  });
  it("produce un hash SHA-256 hex (64 chars)", () => {
    expect(hashEmail("a@b.co")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("hashPhone", () => {
  it("quita símbolos y hashea solo dígitos", () => {
    expect(hashPhone("+506 7129-1909")).toBe(sha("50671291909"));
  });
  it("antepone 506 a números CR de 8 dígitos", () => {
    expect(hashPhone("7129-1909")).toBe(sha("50671291909"));
  });
  it("devuelve null si no hay dígitos", () => {
    expect(hashPhone("")).toBeNull();
    expect(hashPhone("sin numero")).toBeNull();
  });
});

describe("utmCustomData (privacidad)", () => {
  it("deja pasar SOLO los UTMs", () => {
    const out = utmCustomData({
      utmSource: "meta",
      utmCampaign: "julio",
      message: "tengo ansiedad y quiero ayuda", // dato sensible: NO debe pasar
      email: "x@y.com",
      name: "Juan",
    });
    expect(out).toEqual({ utmSource: "meta", utmCampaign: "julio" });
    expect(out).not.toHaveProperty("message");
    expect(out).not.toHaveProperty("email");
    expect(out).not.toHaveProperty("name");
  });
});

describe("sendMetaEvent", () => {
  beforeEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("sale silenciosamente (sin romper) si faltan las env vars", async () => {
    vi.stubEnv("META_PIXEL_ID", "");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const r = await sendMetaEvent({ eventName: "Lead", userData: { email: "a@b.co" } });
    expect(r).toEqual({ sent: false, reason: "missing_env" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("postea a la Graph API con datos hasheados, event_id y test_event_code", async () => {
    vi.stubEnv("META_PIXEL_ID", "123456");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOKEN");
    vi.stubEnv("META_TEST_EVENT_CODE", "TEST123");
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await sendMetaEvent({
      eventName: "Lead",
      eventId: "lead:abc",
      userData: { email: "Test@Example.com", phone: "7129-1909" },
      customData: { utmSource: "meta" },
    });

    expect(r).toEqual({ sent: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/v21.0/123456/events");
    expect(url).toContain("access_token=TOKEN");

    const body = JSON.parse(options.body);
    expect(body.test_event_code).toBe("TEST123");
    const ev = body.data[0];
    expect(ev.event_name).toBe("Lead");
    expect(ev.event_id).toBe("lead:abc");
    expect(ev.user_data.em).toEqual([sha("test@example.com")]);
    expect(ev.user_data.ph).toEqual([sha("50671291909")]);
    expect(ev.custom_data).toEqual({ utmSource: "meta" });
    // el email en claro NUNCA debe viajar
    expect(options.body).not.toContain("test@example.com");
  });

  it("no incluye test_event_code cuando no está configurado", async () => {
    vi.stubEnv("META_PIXEL_ID", "123456");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOKEN");
    vi.stubEnv("META_TEST_EVENT_CODE", "");
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendMetaEvent({ eventName: "Lead", userData: { email: "a@b.co" } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("test_event_code");
  });

  it("devuelve sent:false y no lanza si Meta responde error", async () => {
    vi.stubEnv("META_PIXEL_ID", "123456");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOKEN");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, text: async () => "bad" })));

    const r = await sendMetaEvent({ eventName: "Lead", userData: { email: "a@b.co" } });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe("http_400");
  });

  it("no lanza si fetch explota (resiliencia)", async () => {
    vi.stubEnv("META_PIXEL_ID", "123456");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOKEN");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));

    const r = await sendMetaEvent({ eventName: "Lead", userData: { email: "a@b.co" } });
    expect(r).toEqual({ sent: false, reason: "exception" });
  });
});
